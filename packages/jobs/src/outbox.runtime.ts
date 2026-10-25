import { setTimeout } from 'node:timers/promises';

import { createOutboxRepository } from '@flowboard/database';
import { SilentLogger } from '@flowboard/logger';

import { outboxSettings } from './outbox.config.js';
import { createEventPublisher } from './outbox.publisher.js';
import { createOutboxDispatcher } from './outbox.service.js';

import type { OutboxSettings } from './outbox.config.js';
import type { Logger } from '@flowboard/logger';

export async function closeOutboxResources(
  publisher: { close(): Promise<void> },
  loop: Promise<void> | null,
  repository: { close(): Promise<void> },
) {
  const pending = await Promise.allSettled([Promise.resolve().then(() => publisher.close()), loop]);
  const repositoryResult = await Promise.allSettled([
    Promise.resolve().then(() => repository.close()),
  ]);
  const failed = [...pending, ...repositoryResult].find((result) => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}

export interface OutboxRuntime {
  close(): Promise<void>;
  start(): void;
}

export interface OperationalOutboxRuntime extends OutboxRuntime {
  healthy(): boolean;
  ready(): Promise<void>;
}

export function createOutboxRuntime(
  databaseUrl: string,
  redisUrl: string,
  logger: Logger = SilentLogger,
  overrides: Partial<OutboxSettings> = {},
): OperationalOutboxRuntime {
  const settings = outboxSettings(overrides);
  const repository = createOutboxRepository(databaseUrl);
  const publisher = createEventPublisher(redisUrl, logger);
  const dispatcher = createOutboxDispatcher(repository, publisher, logger, settings);
  const cancellation = new AbortController();
  let loop: Promise<void> | null = null;
  let closing: Promise<void> | null = null;
  let healthy = false;

  async function dispatch() {
    try {
      await dispatcher.runOnce();
      healthy = true;
    } catch (error) {
      healthy = false;
      throw error;
    }
  }

  return {
    healthy: () => healthy && publisher.healthy() && !cancellation.signal.aborted,
    async ready() {
      if (cancellation.signal.aborted) throw new Error('Outbox is closed');

      await publisher.ready();
      await dispatch();
    },
    start() {
      if (loop || cancellation.signal.aborted) return;

      loop = (async () => {
        while (!cancellation.signal.aborted) {
          try {
            await dispatch();
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
        await closeOutboxResources(publisher, loop, repository);
        logger.info('outbox.stopped', { component: 'outbox' });
      })();

      return closing;
    },
  };
}
