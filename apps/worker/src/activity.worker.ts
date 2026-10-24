import { EventChannelName, EventQueueName } from '@flowboard/contracts';
import { createEventConsumerRepository, verifyDatabaseConnection } from '@flowboard/database';
import { SilentLogger } from '@flowboard/logger';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { createActivityProcessor } from './activity.processor.js';

import type { Logger } from '@flowboard/logger';

export function createActivityWorker(
  databaseUrl: string,
  redisUrl: string,
  logger: Logger = SilentLogger,
) {
  const repository = createEventConsumerRepository(databaseUrl);
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    connectTimeout: 1000,
    retryStrategy: (attempt) => Math.min(attempt * 100, 1000),
  });
  const publisher = new Redis(redisUrl, {
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    commandTimeout: 2000,
    connectTimeout: 1000,
    retryStrategy: (attempt) => Math.min(attempt * 100, 1000),
  });
  for (const client of [connection, publisher])
    client.on('error', () =>
      logger.warn('worker.redis.unavailable', { code: 'QUEUE_UNAVAILABLE', component: 'redis' }),
    );
  const active = new Set<Promise<void>>();
  const processor = createActivityProcessor(
    repository,
    async (event) => {
      await publisher.publish(EventChannelName, JSON.stringify(event));
    },
    logger,
  );
  let closing: Promise<void> | undefined;
  let ready = false;
  const worker = new Worker(
    EventQueueName,
    (job) => {
      const action = processor(job);
      active.add(action);
      void action.finally(() => active.delete(action)).catch(() => {});

      return action;
    },
    { connection, concurrency: 4 },
  );
  worker.on('ready', () => {
    ready = true;
  });
  worker.on('error', () =>
    logger.warn('worker.queue.unavailable', { code: 'QUEUE_UNAVAILABLE', component: 'worker' }),
  );
  worker.on('failed', () =>
    logger.warn('worker.event.failed', { code: 'DELIVERY_RETRY', component: 'worker' }),
  );

  return {
    async ready(): Promise<void> {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          worker.waitUntilReady(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Worker not ready')), 5000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
    async healthy(): Promise<boolean> {
      if (
        closing ||
        !ready ||
        !worker.isRunning() ||
        connection.status !== 'ready' ||
        publisher.status !== 'ready'
      )
        return false;

      try {
        await Promise.all([verifyDatabaseConnection(databaseUrl), publisher.ping()]);

        return true;
      } catch {
        return false;
      }
    },
    close(): Promise<void> {
      closing ??= (async () => {
        const stopped = worker.close(true);
        connection.disconnect();
        publisher.disconnect();
        await stopped;
        await Promise.allSettled([...active]);
        await repository.close();
      })();

      return closing;
    },
  };
}
