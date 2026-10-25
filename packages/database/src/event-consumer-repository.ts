import {
  EventJobReferenceSchema,
  OutboxRecordSchema,
  StatusActivityPayloadSchema,
  UuidSchema,
} from '@flowboard/contracts';

import { createClient } from './client.js';

import type { Prisma } from './generated/client.js';
import type { OutboxClaim } from './outbox-repository.js';
import type { EventJobReference, OutboxRecord } from '@flowboard/contracts';

export type EventPersistence =
  { state: 'stale' } | { state: 'invalid' } | { event: OutboxRecord; state: 'ready' };

export interface EventConsumerRepository {
  claim(reference: EventJobReference, leaseMs: number): Promise<OutboxClaim | null>;
  persist(claim: OutboxClaim): Promise<EventPersistence>;
  complete(claim: OutboxClaim): Promise<boolean>;
  retry(claim: OutboxClaim, delayMs: number): Promise<boolean>;
  quarantine(claim: OutboxClaim): Promise<boolean>;
  close(): Promise<void>;
}

async function validRelations(tx: Prisma.TransactionClient, event: OutboxRecord): Promise<boolean> {
  const workspaceId = event.workspaceId;
  if (event.eventType === 'workspace.config.updated') return true;

  if (event.eventType === 'node.updated')
    return (await tx.node.count({ where: { id: event.aggregateId, workspaceId } })) === 1;

  if ((await tx.task.count({ where: { id: event.aggregateId, workspaceId } })) !== 1) return false;

  const listIds = [
    ...new Set([
      event.payload.currentListId,
      ...(event.eventType === 'task.updated' ? [event.payload.previousListId] : []),
    ]),
  ];
  if (
    (await tx.node.count({ where: { workspaceId, id: { in: listIds }, type: 'list' } })) !==
    listIds.length
  )
    return false;

  if (event.eventType === 'task.updated' && event.payload.changes.parentTaskId) {
    const parentIds = [
      ...new Set(Object.values(event.payload.changes.parentTaskId).filter((id) => id !== null)),
    ];
    if (
      (await tx.task.count({ where: { workspaceId, id: { in: parentIds } } })) !== parentIds.length
    )
      return false;
  }

  const statusIds =
    event.eventType === 'task.created'
      ? [event.payload.statusId]
      : event.payload.changes.statusId
        ? Object.values(event.payload.changes.statusId)
        : [];
  const uniqueStatuses = [...new Set(statusIds)];

  return (
    (await tx.statusIdentity.count({ where: { workspaceId, id: { in: uniqueStatuses } } })) ===
    uniqueStatuses.length
  );
}

/** Internal delivery capability; request handlers use only tenant-scoped feed readers. */
export function createEventConsumerRepository(connectionString: string): EventConsumerRepository {
  const client = createClient(connectionString, 3000);
  async function settle(
    claim: OutboxClaim,
    state: 'delivered' | 'pending' | 'failed',
    delayMs: number,
  ) {
    UuidSchema.parse(claim.id);
    UuidSchema.parse(claim.workspaceId);
    UuidSchema.parse(claim.leaseToken);
    if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60000)
      throw new Error('Invalid event retry delay');

    const changed = await client.$executeRaw`
      UPDATE outbox_events SET state = ${state}::"OutboxState",
        completed_at = CASE WHEN ${state} = 'delivered' THEN clock_timestamp() ELSE NULL END,
        next_attempt_at = clock_timestamp() + ${delayMs} * INTERVAL '1 millisecond',
        lease_owner = NULL, lease_until = NULL,
        last_error_code = CASE WHEN ${state} = 'failed' THEN 'INVALID_EVENT' WHEN ${state} = 'pending' THEN 'PROCESSING_RETRY' ELSE NULL END
      WHERE id = ${claim.id}::uuid AND workspace_id = ${claim.workspaceId}::uuid
        AND state = 'processing' AND lease_owner = ${claim.leaseToken}
        AND lease_until > clock_timestamp()
    `;

    return changed === 1;
  }

  return Object.freeze({
    close: () => client.$disconnect(),
    async claim(input: EventJobReference, leaseMs: number) {
      const reference = EventJobReferenceSchema.parse(input);
      if (!Number.isInteger(leaseMs) || leaseMs < 1000 || leaseMs > 60000)
        throw new Error('Invalid processing lease');

      const rows = await client.$queryRaw<OutboxClaim[]>`
        WITH eligible AS (
          SELECT id FROM outbox_events
          WHERE id = ${reference.eventId}::uuid AND workspace_id = ${reference.workspaceId}::uuid
            AND (state IN ('pending', 'dispatching', 'queued') OR (state = 'processing' AND lease_until <= clock_timestamp()))
          FOR UPDATE SKIP LOCKED
        )
        UPDATE outbox_events AS event SET state = 'processing', lease_owner = gen_random_uuid()::text,
          lease_until = clock_timestamp() + ${leaseMs} * INTERVAL '1 millisecond',
          attempts = LEAST(event.attempts::bigint + 1, 2147483647)::integer, last_error_code = NULL
        FROM eligible WHERE event.id = eligible.id
        RETURNING event.id, event.workspace_id AS "workspaceId", event.actor_id AS "actorId",
          event.aggregate_id AS "aggregateId", event.aggregate_type AS "aggregateType", event.aggregate_version AS "aggregateVersion",
          event.event_type AS "eventType", event.schema_version AS "schemaVersion", event.payload, event.attempts, event.lease_owner AS "leaseToken"
      `;

      return rows[0] ?? null;
    },
    persist: (claim: OutboxClaim) =>
      client.$transaction(
        async (tx): Promise<EventPersistence> => {
          const rows = await tx.$queryRaw<OutboxClaim[]>`
        SELECT id, workspace_id AS "workspaceId", actor_id AS "actorId", aggregate_id AS "aggregateId",
          aggregate_type AS "aggregateType", aggregate_version AS "aggregateVersion", event_type AS "eventType",
          schema_version AS "schemaVersion", payload, attempts, lease_owner AS "leaseToken"
        FROM outbox_events WHERE id = ${claim.id}::uuid AND workspace_id = ${claim.workspaceId}::uuid
          AND state = 'processing' AND lease_owner = ${claim.leaseToken} AND lease_until > clock_timestamp() FOR UPDATE
      `;
          const current = rows[0];
          if (!current) return { state: 'stale' };

          const { attempts: _attempts, leaseToken: _token, ...record } = current;
          const parsed = OutboxRecordSchema.safeParse(record);
          if (!parsed.success || !(await validRelations(tx, parsed.data)))
            return { state: 'invalid' };

          const event = parsed.data;
          if (event.eventType === 'task.updated' && event.payload.changes.statusId) {
            const payload = StatusActivityPayloadSchema.safeParse({
              beforeStatusId: event.payload.changes.statusId.before,
              afterStatusId: event.payload.changes.statusId.after,
              occurredAt: event.payload.occurredAt,
              taskVersion: event.payload.taskVersion,
            });
            if (!payload.success) return { state: 'invalid' };

            const existing = await tx.activity.findUnique({ where: { eventId: event.id } });
            if (existing) {
              const existingPayload = StatusActivityPayloadSchema.safeParse(existing.payload);
              if (
                existing.workspaceId !== event.workspaceId ||
                existing.taskId !== event.aggregateId ||
                existing.actorId !== event.actorId ||
                existing.type !== 'task.status_changed' ||
                !existingPayload.success ||
                JSON.stringify(existingPayload.data) !== JSON.stringify(payload.data)
              )
                return { state: 'invalid' };
            } else {
              await tx.activity.create({
                data: {
                  workspaceId: event.workspaceId,
                  taskId: event.aggregateId,
                  actorId: event.actorId,
                  eventId: event.id,
                  type: 'task.status_changed',
                  payload: payload.data,
                },
              });
            }
          }

          return { state: 'ready', event };
        },
        { maxWait: 3000, timeout: 5000 },
      ),
    complete: (claim: OutboxClaim) => settle(claim, 'delivered', 0),
    retry: (claim: OutboxClaim, delayMs: number) => settle(claim, 'pending', delayMs),
    quarantine: (claim: OutboxClaim) => settle(claim, 'failed', 0),
  });
}
