import { EventJobName, EventJobReferenceSchema } from '@flowboard/contracts';
import { SilentLogger, withLogContext } from '@flowboard/logger';
import { UnrecoverableError } from 'bullmq';

import type { OutboxRecord } from '@flowboard/contracts';
import type { EventConsumerRepository } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';

export function createActivityProcessor(
  repository: EventConsumerRepository,
  publish: (event: OutboxRecord) => Promise<void>,
  logger: Logger = SilentLogger,
) {
  return async (job: { data: unknown; id?: string; name: string }): Promise<void> => {
    const reference = EventJobReferenceSchema.safeParse(job.data);
    if (!reference.success || job.name !== EventJobName || job.id !== reference.data.eventId)
      throw new UnrecoverableError('Invalid event job');

    await withLogContext({ workspaceId: reference.data.workspaceId }, async () => {
      const claim = await repository.claim(reference.data, 30000);
      if (!claim) return;

      try {
        const result = await repository.persist(claim);
        if (result.state === 'stale') return;

        if (result.state === 'invalid') {
          await repository.quarantine(claim);
          logger.warn('activity.event.rejected', { code: 'INVALID_EVENT', component: 'worker' });

          return;
        }

        await publish(result.event);
        if (await repository.complete(claim))
          logger.debug('activity.event.delivered', { component: 'worker' });
      } catch {
        try {
          await repository.retry(
            claim,
            Math.min(60000, 500 * 2 ** Math.min(7, Math.max(0, claim.attempts - 1))),
          );
        } catch {
          logger.error('activity.retry.unavailable', {
            code: 'DATABASE_UNAVAILABLE',
            component: 'worker',
          });
        }
        throw new Error('Event delivery failed');
      }
    });
  };
}
