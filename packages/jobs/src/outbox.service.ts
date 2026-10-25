import { EventJobReferenceSchema, OutboxRecordSchema } from '@flowboard/contracts';
import { SilentLogger, withLogContext } from '@flowboard/logger';

import { OutboxDefaults } from './outbox.config.js';

import type { OutboxSettings } from './outbox.config.js';
import type { EventJobReference } from '@flowboard/contracts';
import type { OutboxClaim, OutboxRepository } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';

export interface EventPublisher {
  publish(reference: EventJobReference): Promise<void>;
}

export function retryDelay(attempts: number): number {
  return Math.min(60_000, 250 * 2 ** Math.min(8, Math.max(0, attempts - 1)));
}

export function createOutboxDispatcher(
  repository: OutboxRepository,
  publisher: EventPublisher,
  logger: Logger = SilentLogger,
  settings: OutboxSettings = OutboxDefaults,
) {
  let current: Promise<number> | null = null;
  async function dispatch(claim: OutboxClaim): Promise<number> {
    return withLogContext({ workspaceId: claim.workspaceId, userId: claim.actorId }, async () => {
      const { attempts: _attempts, leaseToken: _token, ...record } = claim;
      try {
        const parsed = OutboxRecordSchema.safeParse(record);
        if (!parsed.success) {
          await repository.quarantine(claim, 'INVALID_EVENT');
          logger.warn('outbox.event.rejected', { code: 'INVALID_EVENT', component: 'outbox' });

          return 0;
        }

        logger.debug('outbox.event.dispatching', { component: 'outbox' });
        await publisher.publish(
          EventJobReferenceSchema.parse({
            schemaVersion: 1,
            eventId: parsed.data.id,
            workspaceId: parsed.data.workspaceId,
          }),
        );
        const acknowledged = await repository.markQueued(claim, settings.recheckMs);
        if (acknowledged) logger.debug('outbox.event.queued', { component: 'outbox' });

        return acknowledged ? 1 : 0;
      } catch {
        logger.warn('outbox.dispatch.retry', { code: 'DISPATCH_RETRY', component: 'outbox' });
        try {
          await repository.retry(claim, {
            code: 'DISPATCH_RETRY',
            delayMs: retryDelay(claim.attempts),
          });
        } catch {
          // The committed event remains recoverable when this lease expires.
          logger.error('outbox.retry.unavailable', {
            code: 'DATABASE_UNAVAILABLE',
            component: 'outbox',
          });
        }

        return 0;
      }
    });
  }
  async function run(): Promise<number> {
    const claims = await repository.claim({ limit: settings.batchSize, leaseMs: settings.leaseMs });
    const results = await Promise.all(claims.map(dispatch));

    return results.reduce((sum, value) => sum + value, 0);
  }

  return {
    runOnce(): Promise<number> {
      current ??= run().finally(() => {
        current = null;
      });

      return current;
    },
  };
}
