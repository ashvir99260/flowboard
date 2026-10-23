import type { RedisOptions } from 'ioredis';

export const RedisConnectionOptions = {
  commandTimeout: 3000,
  connectTimeout: 3000,
  maxRetriesPerRequest: 0,
  retryStrategy: (attempt: number) => Math.min(attempt * 100, 2000),
} satisfies RedisOptions;
