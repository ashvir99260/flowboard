import { setTimeout } from 'node:timers/promises';

import { createOutboxRepository } from '@flowboard/database';
import { SilentLogger } from '@flowboard/logger';

import { outboxSettings } from './outbox.config.ts';
import { createEventPublisher } from './outbox.publisher.ts';
import { createOutboxDispatcher } from './outbox.service.ts';

import type { OutboxSettings } from './outbox.config.ts';
import type { Logger } from '@flowboard/logger';

export interface OutboxRuntime {
  close(): Promise<void>;
  start(): void;
}

export function createOutboxRuntime(
  databaseUrl: string,
  redisUrl: string,
  logger: Logger = SilentLogger,
  overrides: Partial<OutboxSettings> = {},
): OutboxRuntime {
  const settings = outboxSettings(overrides);
  const repository = createOutboxRepository(databaseUrl);
  const publisher = createEventPublisher(redisUrl, logger);
  const dispatcher = createOutboxDispatcher(repository, publisher, logger, settings);
  const cancellation = new AbortController();
  let loop: Promise<void> | null = null;
  let closing: Promise<void> | null = null;

  return {
    start() {
      if (loop || cancellation.signal.aborted) return;

      loop = (async () => {
        while (!cancellation.signal.aborted) {
          try {
            await dispatcher.runOnce();
          } catch {
            logger.error('outbox.poll.failed', {
              code: 'DATABASE_UNAVAILABLE',
              component: 'outbox',
            });
          }
          try {
            await setTimeout(settings.pollMs, undefined, { signal: cancellation.signal });
          } catch {
            /* Shutdown interrupts the idle wait. */
          }
        }
      })();
      logger.info('outbox.started', { component: 'outbox' });
    },
    close() {
      closing ??= (async () => {
        cancellation.abort();
        await publisher.close();
        await loop;
        await repository.close();
        logger.info('outbox.stopped', { component: 'outbox' });
      })();

      return closing;
    },
  };
}
