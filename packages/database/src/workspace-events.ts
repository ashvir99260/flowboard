import { randomUUID } from 'node:crypto';

import { WorkspaceConfigUpdatedEventSchema } from '@flowboard/contracts';

import type { Prisma } from './generated/client.js';

export async function recordWorkspaceChange(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  actorId: string,
  reason: 'membership' | 'invitation' | 'hierarchy',
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
