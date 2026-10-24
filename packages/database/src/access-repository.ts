import {
  ExpectedConfigSchema,
  resolveVisibleTree,
  UpsertGrantSchema,
  UuidSchema,
} from '@flowboard/contracts';

import { DatabaseError } from './tenant-context.js';
import { recordWorkspaceChange } from './workspace-events.js';

import type { Prisma } from './generated/client.js';
import type { NodeRecord } from './repositories.js';
import type { TenantContext } from './tenant-context.js';
import type { UpsertGrant } from '@flowboard/contracts';

export function accessRepository(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  assertActive: () => void,
  findNode: (id: string) => Promise<NodeRecord | null>,
) {
  const { workspaceId, actorUserId } = context;
  async function configuration() {
    assertActive();

    return tx.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { configVersion: true },
    });
  }
  async function resource(resourceId: string) {
    assertActive();
    const node = await findNode(UuidSchema.parse(resourceId));
    if (!node) throw new DatabaseError('NOT_FOUND', 'Container not found');
  }
  async function target(resourceId: string, userId: string) {
    await resource(resourceId);
    if (
      !(await tx.membership.findFirst({ where: { workspaceId, userId: UuidSchema.parse(userId) } }))
    )
      throw new DatabaseError('NOT_FOUND', 'Member not found');

    return { workspaceId, resourceId, userId };
  }
  async function checkVersion(expected: number) {
    const current = await configuration();
    if (current.configVersion !== expected)
      throw new DatabaseError('CONFIG_CONFLICT', 'Workspace configuration changed');

    return current;
  }
  const read = Object.freeze({
    configuration,
    async assignableMemberIds(resourceId: string) {
      assertActive();
      const target = await findNode(resourceId);
      if (!target || target.type !== 'list') throw new DatabaseError('NOT_FOUND', 'List not found');

      const [nodes, grants, members] = await Promise.all([
        tx.node.findMany({ where: { workspaceId, archivedAt: null } }),
        tx.grant.findMany({ where: { workspaceId } }),
        tx.membership.findMany({ where: { workspaceId }, select: { role: true, userId: true } }),
      ]);

      return members
        .filter((member) =>
          resolveVisibleTree(
            nodes,
            grants.filter((grant) => grant.userId === member.userId),
            workspaceId,
            member.role,
          ).some((entry) => entry.node.id === resourceId),
        )
        .map((member) => member.userId);
    },
    async snapshot() {
      assertActive();
      const [nodes, grants, workspace] = await Promise.all([
        tx.node.findMany({ where: { workspaceId, archivedAt: null } }),
        tx.grant.findMany({ where: { workspaceId, userId: actorUserId } }),
        tx.workspace.findUniqueOrThrow({
          where: { id: workspaceId },
          select: { configVersion: true, dataVersion: true, id: true, name: true },
        }),
      ]);

      return { nodes, grants, workspace };
    },
    async listGrants(
      resourceId: string,
      query: { after?: { createdAt: Date; id: string }; limit: number },
    ) {
      await resource(resourceId);
      if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100)
        throw new DatabaseError('VALIDATION_FAILED', 'Invalid page limit');

      return tx.grant.findMany({
        where: {
          workspaceId,
          resourceId,
          ...(query.after
            ? {
                OR: [
                  { createdAt: { gt: query.after.createdAt } },
                  {
                    createdAt: query.after.createdAt,
                    userId: { gt: UuidSchema.parse(query.after.id) },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
        take: query.limit + 1,
      });
    },
  });

  return {
    read,
    write: Object.freeze({
      ...read,
      async upsertGrant(resourceId: string, input: UpsertGrant) {
        const parsed = UpsertGrantSchema.parse(input);
        const where = await target(resourceId, parsed.userId);
        const current = await checkVersion(parsed.expectedConfigVersion);
        const existing = await tx.grant.findUnique({
          where: { workspaceId_resourceId_userId: where },
        });
        if (existing?.mode === parsed.mode) return { data: existing, ...current };

        const data = await tx.grant.upsert({
          where: { workspaceId_resourceId_userId: where },
          create: { ...where, mode: parsed.mode },
          update: { mode: parsed.mode },
        });
        const versions = await recordWorkspaceChange(tx, workspaceId, actorUserId, 'permission');

        return { data, configVersion: versions.configVersion };
      },
      async removeGrant(
        resourceId: string,
        userId: string,
        input: { expectedConfigVersion: number },
      ) {
        const parsed = ExpectedConfigSchema.parse(input);
        const where = await target(resourceId, userId);
        await checkVersion(parsed.expectedConfigVersion);
        const { count } = await tx.grant.deleteMany({ where });
        if (count !== 0) await recordWorkspaceChange(tx, workspaceId, actorUserId, 'permission');
      },
    }),
  };
}
