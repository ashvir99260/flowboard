import { EventJobName, EventJobReferenceSchema, EventQueueName } from '@flowboard/contracts';
import { SilentLogger } from '@flowboard/logger';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import type { EventPublisher } from './outbox.service.js';
import type { EventJobReference } from '@flowboard/contracts';
import type { Logger } from '@flowboard/logger';

export function createEventPublisher(
  redisUrl: string,
  logger: Logger = SilentLogger,
): EventPublisher & { close(): Promise<void> } {
  const redis = new Redis(redisUrl, {
    commandTimeout: 2000,
    connectTimeout: 1000,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: (attempt) => Math.min(100 * attempt, 1000),
  });
  redis.on('error', () =>
    logger.warn('outbox.redis.unavailable', { code: 'QUEUE_UNAVAILABLE', component: 'redis' }),
  );
  let queue: Queue<EventJobReference> | null = null;
  let closed = false;
  let closing: Promise<void> | null = null;

  return {
    async publish(input: EventJobReference) {
      const reference = EventJobReferenceSchema.parse(input);
      if (closed || redis.status !== 'ready') throw new Error('Event queue unavailable');

      if (!queue) {
        queue = new Queue<EventJobReference>(EventQueueName, {
          connection: redis,
          skipWaitingForReady: true,
          defaultJobOptions: {
            attempts: 5,
            backoff: { delay: 1000, type: 'exponential' },
            removeOnComplete: true,
            removeOnFail: true,
          },
        });
        queue.on('error', () =>
          logger.warn('outbox.queue.unavailable', {
            code: 'QUEUE_UNAVAILABLE',
            component: 'redis',
          }),
        );
      }

      const current = queue;
      try {
        await current.add(EventJobName, reference, { jobId: reference.eventId });
      } catch {
        if (queue === current) queue = null;

        await current.close();
        throw new Error('Event queue unavailable');
      }
    },
    close() {
      closing ??= (async () => {
        closed = true;
        redis.disconnect();
        await queue?.close();
        queue = null;
      })();

      return closing;
    },
  };
}
