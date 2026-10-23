import { randomBytes } from 'node:crypto';

import { LogInSchema, SignUpSchema, UuidSchema } from '@flowboard/contracts';

import { createClient } from './client.js';
import { hashPassword, verifyPassword } from './password.js';
import { DatabaseError, exactKeys } from './tenant-context.js';

import type { Prisma, RefreshSession } from './generated/client.js';
import type { IdentitySession, RefreshResult, SessionCredential } from './identity.entity.js';
import type { LogIn, SignUp } from '@flowboard/contracts';

const userSelect = { createdAt: true, email: true, id: true, name: true, updatedAt: true } as const;
const workspaceSelect = { createdAt: true, id: true, name: true, updatedAt: true } as const;

function validateCredential(value: SessionCredential) {
  exactKeys(value, ['expiresAt', 'familyId', 'tokenDigest']);
  UuidSchema.parse(value.familyId);
  if (
    !/^[a-f0-9]{64}$/.test(value.tokenDigest) ||
    !(value.expiresAt instanceof Date) ||
    !Number.isFinite(value.expiresAt.getTime())
  )
    throw new DatabaseError('VALIDATION_FAILED', 'Invalid session credential');
}

/** The only global identity boundary; never exports Prisma or credential rows. */
export function createIdentityRepository(databaseUrl: string) {
  const client = createClient(databaseUrl, 5000);
  // Unknown users still incur the same Argon2 verification work.
  const dummyHash = hashPassword(randomBytes(32).toString('base64url'));
  async function available<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'P2002' && 'meta' in error) {
          const meta = error.meta as {
            driverAdapterError?: { cause?: { constraint?: { index?: string }; table?: string } };
            modelName?: string;
            target?: unknown;
          };
          const cause = meta.driverAdapterError?.cause;
          const emailConstraint =
            (Array.isArray(meta.target) && meta.target.includes('email')) ||
            (cause?.table === 'users' && cause.constraint?.index === 'users_email_key');
          if (meta.modelName === 'User' && emailConstraint)
            throw new DatabaseError('EMAIL_IN_USE', 'Email is already registered');
        }
        if (['P1001', 'P1002', 'P1017', 'ECONNREFUSED', 'ETIMEDOUT'].includes(String(error.code)))
          throw new DatabaseError('SERVICE_UNAVAILABLE', 'Identity storage unavailable');
      }
      throw error;
    }
  }
  async function describe(
    tx: Prisma.TransactionClient,
    userId: string,
    credential: SessionCredential,
    workspaceId: string | null,
  ): Promise<IdentitySession> {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
    const membership = workspaceId
      ? await tx.membership.findUnique({
          where: { workspaceId_userId: { userId, workspaceId } },
          include: { workspace: { select: workspaceSelect } },
        })
      : null;
    if (workspaceId && !membership)
      throw new DatabaseError('MEMBERSHIP_REQUIRED', 'Workspace membership required');
    return {
      activeWorkspace: membership ? { ...membership.workspace, role: membership.role } : null,
      expiresAt: credential.expiresAt,
      familyId: credential.familyId,
      user,
    };
  }
  async function open(tx: Prisma.TransactionClient, userId: string, credential: SessionCredential) {
    const membership = await tx.membership.findFirst({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { workspaceId: 'asc' }],
    });
    const workspaceId = membership?.workspaceId ?? null;
    await tx.refreshSession.create({
      data: { ...credential, activeWorkspaceId: workspaceId, userId },
    });
    return describe(tx, userId, credential, workspaceId);
  }
  async function withCredential<T>(
    digest: string,
    missing: T,
    operation: (tx: Prisma.TransactionClient, row: RefreshSession, now: Date) => Promise<T>,
  ): Promise<T> {
    if (!/^[a-f0-9]{64}$/.test(digest))
      throw new DatabaseError('VALIDATION_FAILED', 'Invalid credential digest');
    return available(async () => {
      const owner = await client.refreshSession.findUnique({
        where: { tokenDigest: digest },
        select: { userId: true },
      });
      if (!owner) return missing;
      return client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${owner.userId}::uuid FOR UPDATE`;
        const row = await tx.refreshSession.findUnique({ where: { tokenDigest: digest } });
        if (!row) return missing;
        // Read after the lock: a waited-on rotation may have created newer rows.
        const [clock] = await tx.$queryRaw<
          { now: Date }[]
        >`SELECT clock_timestamp()::timestamptz(3) AS now`;
        if (!clock) throw new Error('Database clock unavailable');
        return operation(tx, row, clock.now);
      });
    });
  }
  return {
    async rotate(digest: string, replacementDigest: string): Promise<RefreshResult> {
      if (!/^[a-f0-9]{64}$/.test(replacementDigest))
        throw new DatabaseError('VALIDATION_FAILED', 'Invalid replacement digest');
      return withCredential<RefreshResult>(digest, { status: 'invalid' }, async (tx, row, now) => {
        if (row.usedAt) {
          await tx.refreshSession.updateMany({
            where: { userId: row.userId, familyId: row.familyId, revokedAt: null },
            data: { revokedAt: now },
          });
          // Returning commits revocation; throwing here would roll it back.
          return { status: 'reused' };
        }
        if (row.revokedAt || row.expiresAt <= now) return { status: 'invalid' };
        const session = await describe(tx, row.userId, row, row.activeWorkspaceId);
        await tx.refreshSession.update({ where: { id: row.id }, data: { usedAt: now } });
        const replacement = await tx.refreshSession.create({
          data: {
            activeWorkspaceId: row.activeWorkspaceId,
            expiresAt: row.expiresAt,
            familyId: row.familyId,
            tokenDigest: replacementDigest,
            userId: row.userId,
          },
        });
        await tx.refreshSession.update({
          where: { id: row.id },
          data: { replacedById: replacement.id },
        });
        return { session, status: 'rotated' };
      });
    },
    async revoke(digest: string): Promise<void> {
      return withCredential<void>(digest, undefined, async (tx, row, now) => {
        await tx.refreshSession.updateMany({
          where: { userId: row.userId, familyId: row.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
      });
    },
    async register(input: SignUp, credential: SessionCredential) {
      const data = SignUpSchema.parse(input);
      validateCredential(credential);
      const passwordHash = await hashPassword(data.password);
      return available(() =>
        client.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: { email: data.email, name: data.name, passwordHash },
          });
          const workspace = await tx.workspace.create({ data: { name: data.workspaceName } });
          await tx.membership.create({
            data: { role: 'admin', userId: user.id, workspaceId: workspace.id },
          });
          for (const [position, status] of [
            { category: 'not_started', color: '#64748b', key: 'todo', name: 'To do' },
            { category: 'active', color: '#2563eb', key: 'doing', name: 'In progress' },
            { category: 'done', color: '#16a34a', key: 'done', name: 'Done' },
          ].entries()) {
            const identity = await tx.statusIdentity.create({
              data: {
                category: status.category as 'not_started' | 'active' | 'done',
                key: status.key,
                workspaceId: workspace.id,
              },
            });
            await tx.statusOverride.create({
              data: {
                color: status.color,
                hidden: false,
                name: status.name,
                ownerId: workspace.id,
                ownerType: 'workspace',
                position,
                statusId: identity.id,
                workspaceId: workspace.id,
              },
            });
          }
          return open(tx, user.id, credential);
        }),
      );
    },
    async logIn(input: LogIn, credential: SessionCredential) {
      const data = LogInSchema.parse(input);
      validateCredential(credential);
      return available(async () => {
        const user = await client.user.findUnique({ where: { email: data.email } });
        const matches = await verifyPassword(
          user?.passwordHash ?? (await dummyHash),
          data.password,
        );
        if (!user || !matches)
          throw new DatabaseError('UNAUTHENTICATED', 'Invalid email or password');
        return client.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
          const current = await tx.user.findUnique({ where: { id: user.id } });
          if (!current || current.passwordHash !== user.passwordHash)
            throw new DatabaseError('UNAUTHENTICATED', 'Invalid email or password');
          return open(tx, user.id, credential);
        });
      });
    },
    async authenticate(input: { familyId: string; userId: string; workspaceId: string | null }) {
      exactKeys(input, ['familyId', 'userId', 'workspaceId']);
      UuidSchema.parse(input.familyId);
      UuidSchema.parse(input.userId);
      if (input.workspaceId !== null) UuidSchema.parse(input.workspaceId);
      return available(() =>
        client.$transaction(
          async (tx) => {
            const row = await tx.refreshSession.findFirst({
              where: {
                familyId: input.familyId,
                userId: input.userId,
                usedAt: null,
                revokedAt: null,
                expiresAt: { gt: new Date() },
              },
            });
            if (!row || row.activeWorkspaceId !== input.workspaceId)
              throw new DatabaseError('UNAUTHENTICATED', 'Session is unavailable');
            return describe(tx, row.userId, row, row.activeWorkspaceId);
          },
          { isolationLevel: 'RepeatableRead' },
        ),
      );
    },
    async close() {
      await dummyHash;
      await client.$disconnect();
    },
  };
}

export type IdentityRepository = ReturnType<typeof createIdentityRepository>;
