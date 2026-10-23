import { verifyDatabaseConnection } from '@flowboard/database';
import { SilentLogger } from '@flowboard/logger';
import { Redis } from 'ioredis';

import { RedisConnectionOptions } from '../../config/redis.config.js';

import type { Logger } from '@flowboard/logger';

export const DependencyProbeKey = Symbol('DependencyProbe');

export interface DependencyProbe {
  check(): Promise<void>;
  close(): Promise<void>;
}

export function runtimeProbe(
  databaseUrl: string,
  redisUrl: string,
  logger: Logger = SilentLogger,
): DependencyProbe {
  const redis = new Redis(redisUrl, {
    ...RedisConnectionOptions,
    enableOfflineQueue: false,
  });
  // Readiness observes connection errors; connection strings never enter logs.
  redis.on('error', () =>
    logger.warn('dependency.unavailable', { component: 'redis', operation: 'health' }),
  );
  return {
    async check() {
      return logger.observe('dependencies.check', async () => {
        const results = await Promise.allSettled([
          verifyDatabaseConnection(databaseUrl),
          redis.ping(),
        ]);
        if (results.some((result) => result.status === 'rejected'))
          throw new Error('Dependencies unavailable');
      });
    },
    async close() {
      redis.disconnect();
    },
  };
}
