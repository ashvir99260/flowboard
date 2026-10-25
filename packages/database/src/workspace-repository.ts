import { ExpectedConfigSchema, UpdateWorkspaceSchema } from '@flowboard/contracts';

import { DatabaseError } from './tenant-context.js';
import { recordWorkspaceChange } from './workspace-events.js';

import type { Prisma } from './generated/client.js';
import type { TenantContext } from './tenant-context.js';
import type { UpdateWorkspace, WorkspaceEnvelope } from '@flowboard/contracts';

export const workspaceSelect = {
  archivedAt: true,
  configVersion: true,
  createdAt: true,
  dataVersion: true,
  id: true,
  name: true,
  updatedAt: true,
} as const;

export function presentWorkspace(workspace: {
  archivedAt: Date | null;
  configVersion: number;
  createdAt: Date;
  dataVersion: number;
  id: string;
  name: string;
  updatedAt: Date;
}): WorkspaceEnvelope {
  const { configVersion, dataVersion, ...data } = workspace;

  return {
    data: {
      ...data,
      archivedAt: data.archivedAt?.toISOString() ?? null,
      createdAt: data.createdAt.toISOString(),
      updatedAt: data.updatedAt.toISOString(),
    },
    configVersion,
    dataVersion,
  };
}

export function workspaceRepository(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  assertActive: () => void,
) {
  async function snapshot() {
    assertActive();
    const workspace = await tx.workspace.findUnique({
      where: { id: context.workspaceId },
      select: workspaceSelect,
    });
    if (!workspace) throw new DatabaseError('NOT_FOUND', 'Workspace not found');

    return presentWorkspace(workspace);
  }
  async function precondition(expected: number) {
    const current = await snapshot();
    if (context.role !== 'admin') throw new DatabaseError('FORBIDDEN', 'Access denied');

    if (current.configVersion !== expected)
      throw new DatabaseError('CONFIG_CONFLICT', 'Workspace configuration changed');

    return current;
  }
  const read = Object.freeze({ snapshot });

  return {
    read,
    write: Object.freeze({
      ...read,
      async rename(input: UpdateWorkspace) {
        const value = UpdateWorkspaceSchema.parse(input);
        const current = await precondition(value.expectedConfigVersion);
        if (current.data.name === value.name) return current;

        await tx.workspace.update({
          where: { id: context.workspaceId },
          data: { name: value.name },
        });
        await recordWorkspaceChange(tx, context.workspaceId, context.actorUserId, 'hierarchy');

        return snapshot();
      },
      async archive(input: { expectedConfigVersion: number }) {
        const value = ExpectedConfigSchema.parse(input);
        await precondition(value.expectedConfigVersion);
        await tx.$executeRaw`UPDATE workspaces SET archived_at = clock_timestamp()::timestamptz(3) WHERE id = ${context.workspaceId}::uuid`;
        await recordWorkspaceChange(
          tx,
          context.workspaceId,
          context.actorUserId,
          'hierarchy',
          true,
        );

        return snapshot();
      },
    }),
  };
}
