import { randomUUID } from 'node:crypto';

import { TaskCreatedEventSchema, TaskUpdatedEventSchema } from '@flowboard/contracts';

import type { Prisma } from './generated/client.js';
import type { TenantContext } from './tenant-context.js';
import type { TaskUpdatedEvent } from '@flowboard/contracts';

export async function recordTaskChanges(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  entries: readonly {
    changes?: TaskUpdatedEvent['changes'];
    previousListId?: string;
    task: { id: string; primaryListId: string; statusId: string; updatedAt: Date; version: number };
  }[],
) {
  if (entries.length === 0) throw new Error('Task event batch must not be empty');

  const revisions = await tx.workspace.update({
    where: { id: context.workspaceId },
    data: { dataVersion: { increment: 1 } },
    select: { configVersion: true, dataVersion: true },
  });
  for (const { task, changes, previousListId } of entries) {
    const identity = {
      eventId: randomUUID(),
      workspaceId: context.workspaceId,
      actorId: context.actorUserId,
      schemaVersion: 1,
      occurredAt: task.updatedAt.toISOString(),
      taskId: task.id,
      taskVersion: task.version,
      currentListId: task.primaryListId,
    };
    const payload = changes
      ? TaskUpdatedEventSchema.parse({
          ...identity,
          previousListId: previousListId ?? task.primaryListId,
          changes,
        })
      : TaskCreatedEventSchema.parse({ ...identity, statusId: task.statusId });
    await tx.outboxEvent.create({
      data: {
        id: payload.eventId,
        workspaceId: context.workspaceId,
        actorId: context.actorUserId,
        createdAt: task.updatedAt,
        aggregateType: 'task',
        aggregateId: task.id,
        aggregateVersion: task.version,
        eventType: changes ? 'task.updated' : 'task.created',
        payload,
      },
    });
  }

  return revisions;
}

export function recordTaskChange(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  task: Parameters<typeof recordTaskChanges>[2][number]['task'],
  changes?: TaskUpdatedEvent['changes'],
) {
  return recordTaskChanges(tx, context, [{ task, changes }]);
}
