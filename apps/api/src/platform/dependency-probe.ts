import { verifyDatabaseConnection } from '@flowboard/database';
import { Redis } from 'ioredis';

import { RedisConnectionOptions } from '../common/config/redis.config.js';

export const DependencyProbeKey = Symbol('DependencyProbe');
export interface DependencyProbe {
  check(): Promise<void>;
  close(): Promise<void>;
}

export function runtimeProbe(databaseUrl: string, redisUrl: string): DependencyProbe {
  const redis = new Redis(redisUrl, {
    ...RedisConnectionOptions,
    enableOfflineQueue: false,
  });
  // Readiness observes connection errors; connection strings never enter logs.
  redis.on('error', () => undefined);
  return {
    async check() {
      const results = await Promise.allSettled([
        verifyDatabaseConnection(databaseUrl),
        redis.ping(),
      ]);
      if (results.some((result) => result.status === 'rejected'))
        throw new Error('Dependencies unavailable');
    },
    async close() {
      redis.disconnect();
    },
  };
}
