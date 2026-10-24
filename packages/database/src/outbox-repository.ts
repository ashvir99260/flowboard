import { UuidSchema } from '@flowboard/contracts';

import { createClient } from './client.js';

export type OutboxClaim = {
  actorId: string;
  aggregateId: string;
  aggregateType: string;
  aggregateVersion: number;
  attempts: number;
  eventType: string;
  id: string;
  leaseToken: string;
  payload: unknown;
  schemaVersion: number;
  workspaceId: string;
};

export interface OutboxRepository {
  claim(options: { leaseMs: number; limit: number }): Promise<OutboxClaim[]>;
  close(): Promise<void>;
  markQueued(claim: OutboxClaim, recheckMs: number): Promise<boolean>;
  quarantine(claim: OutboxClaim, code: string): Promise<boolean>;
  retry(claim: OutboxClaim, options: { code: string; delayMs: number }): Promise<boolean>;
}

function bounded(value: number, minimum: number, maximum: number) {
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new Error('Invalid outbox operation bound');
}

/** Internal operational capability. Never expose it through request tenant repositories. */
export function createOutboxRepository(connectionString: string): OutboxRepository {
  const client = createClient(connectionString, 3000);
  async function settle(
    claim: OutboxClaim,
    state: 'queued' | 'pending' | 'failed',
    delayMs: number,
    code: string | null,
  ) {
    UuidSchema.parse(claim.id);
    UuidSchema.parse(claim.workspaceId);
    UuidSchema.parse(claim.leaseToken);
    bounded(delayMs, 0, 86_400_000);
    if (code !== null && !/^[A-Z][A-Z0-9_]{0,63}$/.test(code))
      throw new Error('Invalid outbox error code');

    const changed = await client.$executeRaw`
      UPDATE outbox_events SET state = ${state}::"OutboxState",
        next_attempt_at = clock_timestamp() + ${delayMs} * INTERVAL '1 millisecond',
        lease_owner = NULL, lease_until = NULL, last_error_code = ${code}
      WHERE id = ${claim.id}::uuid AND workspace_id = ${claim.workspaceId}::uuid
        AND state = 'dispatching' AND lease_owner = ${claim.leaseToken}
        AND lease_until > clock_timestamp()
    `;

    return changed === 1;
  }

  return Object.freeze({
    close: () => client.$disconnect(),
    async claim({ limit, leaseMs }: { leaseMs: number; limit: number }) {
      bounded(limit, 1, 100);
      bounded(leaseMs, 1000, 60_000);

      return client.$queryRaw<OutboxClaim[]>`
        WITH due AS (
          SELECT id FROM outbox_events
          WHERE (state IN ('pending', 'queued') AND next_attempt_at <= clock_timestamp())
             OR (state IN ('dispatching', 'processing') AND lease_until <= clock_timestamp())
          ORDER BY next_attempt_at, id FOR UPDATE SKIP LOCKED LIMIT ${limit}
        )
        UPDATE outbox_events AS event SET state = 'dispatching',
          lease_owner = gen_random_uuid()::text,
          lease_until = clock_timestamp() + ${leaseMs} * INTERVAL '1 millisecond',
          attempts = LEAST(event.attempts::bigint + 1, 2147483647)::integer,
          last_error_code = NULL
        FROM due WHERE event.id = due.id
        RETURNING event.id, event.workspace_id AS "workspaceId", event.actor_id AS "actorId",
          event.aggregate_id AS "aggregateId", event.aggregate_type AS "aggregateType",
          event.aggregate_version AS "aggregateVersion", event.event_type AS "eventType",
          event.schema_version AS "schemaVersion", event.payload, event.attempts,
          event.lease_owner AS "leaseToken"
      `;
    },
    markQueued: (claim: OutboxClaim, recheckMs: number) => settle(claim, 'queued', recheckMs, null),
    quarantine: (claim: OutboxClaim, code: string) => settle(claim, 'failed', 0, code),
    retry: (claim: OutboxClaim, { code, delayMs }: { code: string; delayMs: number }) =>
      settle(claim, 'pending', delayMs, code),
  });
}
