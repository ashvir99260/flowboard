import { ActivitySchema, UuidSchema } from '@flowboard/contracts';

import { DatabaseError, exactKeys } from './tenant-context.js';

import type { Prisma } from './generated/client.js';
import type { TenantContext } from './tenant-context.js';
import type { Activity } from '@flowboard/contracts';

export interface ActivityPosition {
  createdAt: Date;
  id: string;
}

export function activityRepository(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  assertActive: () => void,
) {
  function position(value: ActivityPosition) {
    exactKeys(value, ['createdAt', 'id']);
    if (!(value.createdAt instanceof Date) || !Number.isFinite(value.createdAt.getTime()))
      throw new DatabaseError('INVALID_CURSOR', 'Invalid activity position');

    return { createdAt: value.createdAt, id: UuidSchema.parse(value.id) };
  }

  return Object.freeze({
    async list(
      taskId: string,
      options: { after?: ActivityPosition; limit: number; upper?: ActivityPosition },
    ): Promise<{ items: Activity[]; upper?: ActivityPosition }> {
      assertActive();
      exactKeys(options, ['limit', 'after', 'upper']);
      const id = UuidSchema.parse(taskId);
      const workspaceId = context.workspaceId;
      if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100)
        throw new DatabaseError('VALIDATION_FAILED', 'Invalid activity page limit');

      if (
        !(await tx.task.findFirst({
          where: { id, workspaceId, archivedAt: null },
          select: { id: true },
        }))
      )
        throw new DatabaseError('NOT_FOUND', 'Task not found');

      const after = options.after ? position(options.after) : undefined;
      const upper = options.upper ? position(options.upper) : undefined;
      const rows = await tx.activity.findMany({
        where: {
          taskId: id,
          workspaceId,
          AND: [
            ...(upper
              ? [
                  {
                    OR: [
                      { createdAt: { lt: upper.createdAt } },
                      { createdAt: upper.createdAt, id: { lte: upper.id } },
                    ],
                  },
                ]
              : []),
            ...(after
              ? [
                  {
                    OR: [
                      { createdAt: { lt: after.createdAt } },
                      { createdAt: after.createdAt, id: { lt: after.id } },
                    ],
                  },
                ]
              : []),
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: options.limit + 1,
        include: { actor: { select: { id: true, name: true } } },
      });
      const items = rows.map((row) => {
        const parsed = ActivitySchema.safeParse({
          id: row.id,
          workspaceId: row.workspaceId,
          taskId: row.taskId,
          eventId: row.eventId,
          actor: row.actor,
          type: row.type,
          payload: row.payload,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        });
        if (!parsed.success)
          throw new DatabaseError('INTERNAL_ERROR', 'Stored activity is invalid');

        return parsed.data;
      });
      const first = rows[0];

      return {
        items,
        ...(upper || first
          ? { upper: upper ?? { createdAt: first!.createdAt, id: first!.id } }
          : {}),
      };
    },
  });
}
