import { randomUUID } from 'node:crypto';

import {
  AddMemberSchema,
  TaskUpdatedEventSchema,
  UpdateMemberSchema,
  UuidSchema,
  VersionSchema,
  WorkspaceConfigUpdatedEventSchema,
} from '@flowboard/contracts';

import { DatabaseError, exactKeys } from './tenant-context.js';

import type { Prisma } from './generated/client.js';
import type { MemberProfile, MembershipPageQuery } from './membership.entity.js';
import type { TenantContext } from './tenant-context.js';
import type { AddMember, UpdateMember } from '@flowboard/contracts';

export async function recordWorkspaceChange(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  actorId: string,
  reason: 'membership' | 'invitation',
  dataChanged = false,
) {
  const workspace = await tx.workspace.update({
    where: { id: workspaceId },
    data: {
      configVersion: { increment: 1 },
      ...(dataChanged ? { dataVersion: { increment: 1 } } : {}),
    },
    select: { configVersion: true, dataVersion: true },
  });
  const [clock] = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT clock_timestamp()::timestamptz(3) AS now`;
  if (!clock) throw new Error('Database clock unavailable');

  const eventId = randomUUID();
  const payload = WorkspaceConfigUpdatedEventSchema.parse({
    eventId,
    workspaceId,
    actorId,
    schemaVersion: 1,
    occurredAt: clock.now.toISOString(),
    configVersion: workspace.configVersion,
    reason,
  });
  await tx.outboxEvent.create({
    data: {
      id: eventId,
      workspaceId,
      actorId,
      aggregateType: 'workspace_config',
      aggregateId: workspaceId,
      aggregateVersion: workspace.configVersion,
      eventType: 'workspace.config.updated',
      payload,
    },
  });

  return workspace;
}

export function validateMembershipPage(query: MembershipPageQuery) {
  exactKeys(query, ['after', 'limit']);
  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100)
    throw new DatabaseError('VALIDATION_FAILED', 'Invalid page limit');

  if (query.after) {
    exactKeys(query.after, ['createdAt', 'id']);
    UuidSchema.parse(query.after.id);
    if (
      !(query.after.createdAt instanceof Date) ||
      !Number.isFinite(query.after.createdAt.getTime())
    )
      throw new DatabaseError('INVALID_CURSOR', 'Invalid page position');
  }
}

export function membershipRepository(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  assertActive: () => void,
) {
  const { workspaceId } = context;
  async function profile(userId: string): Promise<MemberProfile> {
    assertActive();
    const row = await tx.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: UuidSchema.parse(userId) } },
      include: { user: { select: { email: true, name: true } } },
    });
    if (!row) throw new DatabaseError('NOT_FOUND', 'Member not found');

    const { user, ...member } = row;

    return { ...member, ...user };
  }
  async function checkVersion(expected: number) {
    assertActive();
    VersionSchema.parse(expected);
    const current = await tx.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { configVersion: true },
    });
    if (current.configVersion !== expected)
      throw new DatabaseError('CONFIG_CONFLICT', 'Workspace configuration changed');

    return current.configVersion;
  }
  async function protectAdmin(member: MemberProfile, nextRole: string | null) {
    if (
      member.role === 'admin' &&
      nextRole !== 'admin' &&
      (await tx.membership.count({ where: { workspaceId, role: 'admin' } })) <= 1
    )
      throw new DatabaseError('LAST_ADMIN', 'The last workspace administrator cannot be removed');
  }
  const read = Object.freeze({
    async list(query: MembershipPageQuery): Promise<MemberProfile[]> {
      assertActive();
      validateMembershipPage(query);
      const members = await tx.membership.findMany({
        where: {
          workspaceId,
          ...(query.after
            ? {
                OR: [
                  { createdAt: { gt: query.after.createdAt } },
                  { createdAt: query.after.createdAt, userId: { gt: query.after.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
        take: query.limit + 1,
        select: {
          createdAt: true,
          updatedAt: true,
          userId: true,
          workspaceId: true,
          role: true,
          user: { select: { email: true, name: true } },
        },
      });

      return members.map(({ user, ...member }) => ({ ...member, ...user }));
    },
    async configuration() {
      assertActive();

      return tx.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { configVersion: true, dataVersion: true },
      });
    },
  });
  const write = Object.freeze({
    ...read,
    async invite(input: AddMember, tokenDigest: string) {
      const data = AddMemberSchema.parse(input);
      await checkVersion(data.expectedConfigVersion);
      if (!/^[a-f0-9]{64}$/.test(tokenDigest))
        throw new DatabaseError('VALIDATION_FAILED', 'Invalid invitation digest');

      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT clock_timestamp()::timestamptz(3) AS now`;
      if (!clock) throw new Error('Database clock unavailable');

      const invitation = await tx.invitation.create({
        data: {
          workspaceId,
          email: data.email,
          role: data.role,
          tokenDigest,
          createdById: context.actorUserId,
          expiresAt: new Date(clock.now.getTime() + 48 * 3600_000),
        },
        select: { expiresAt: true, id: true },
      });
      const { configVersion } = await recordWorkspaceChange(
        tx,
        workspaceId,
        context.actorUserId,
        'invitation',
      );

      return { invitation, configVersion };
    },
    async add(input: AddMember) {
      const data = AddMemberSchema.parse(input);
      await checkVersion(data.expectedConfigVersion);
      const user = await tx.user.findUnique({ where: { email: data.email }, select: { id: true } });
      if (!user) throw new DatabaseError('NOT_FOUND', 'Account not found');

      if (
        await tx.membership.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: user.id } },
        })
      )
        throw new DatabaseError('MEMBERSHIP_EXISTS', 'Account is already a workspace member');

      await tx.membership.create({ data: { workspaceId, userId: user.id, role: data.role } });
      const { configVersion } = await recordWorkspaceChange(
        tx,
        workspaceId,
        context.actorUserId,
        'membership',
      );

      return { member: await profile(user.id), configVersion };
    },
    async update(userId: string, input: UpdateMember) {
      const data = UpdateMemberSchema.parse(input);
      const configVersion = await checkVersion(data.expectedConfigVersion);
      const member = await profile(userId);
      await protectAdmin(member, data.role);
      if (member.role === data.role) return { member, configVersion };

      await tx.membership.update({
        where: { workspaceId_userId: { workspaceId, userId } },
        data: { role: data.role },
      });
      const revision = await recordWorkspaceChange(
        tx,
        workspaceId,
        context.actorUserId,
        'membership',
      );

      return { member: await profile(userId), configVersion: revision.configVersion };
    },
    async remove(userId: string, expectedConfigVersion: number) {
      await checkVersion(expectedConfigVersion);
      const member = await profile(userId);
      await protectAdmin(member, null);
      const assignments = await tx.taskAssignee.findMany({
        where: { workspaceId, userId },
        select: {
          task: {
            include: { assignees: { select: { userId: true }, orderBy: { userId: 'asc' } } },
          },
        },
      });
      await tx.grant.deleteMany({ where: { workspaceId, userId } });
      await tx.taskAssignee.deleteMany({ where: { workspaceId, userId } });
      for (const { task } of assignments) {
        const updated = await tx.task.update({
          where: { workspaceId_id: { workspaceId, id: task.id } },
          data: { version: { increment: 1 } },
          select: { updatedAt: true, version: true },
        });
        const eventId = randomUUID();
        const payload = TaskUpdatedEventSchema.parse({
          eventId,
          workspaceId,
          actorId: context.actorUserId,
          schemaVersion: 1,
          occurredAt: updated.updatedAt.toISOString(),
          taskId: task.id,
          taskVersion: updated.version,
          previousListId: task.primaryListId,
          currentListId: task.primaryListId,
          changes: {
            assigneeIds: {
              before: task.assignees.map((row) => row.userId),
              after: task.assignees
                .filter((row) => row.userId !== member.userId)
                .map((row) => row.userId),
            },
          },
        });
        await tx.outboxEvent.create({
          data: {
            id: eventId,
            workspaceId,
            actorId: context.actorUserId,
            aggregateType: 'task',
            aggregateId: task.id,
            aggregateVersion: updated.version,
            eventType: 'task.updated',
            payload,
          },
        });
      }
      await tx.membership.delete({ where: { workspaceId_userId: { workspaceId, userId } } });
      await recordWorkspaceChange(
        tx,
        workspaceId,
        context.actorUserId,
        'membership',
        assignments.length > 0,
      );
    },
  });

  return { read, write };
}
