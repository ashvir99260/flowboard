import { createHash } from 'node:crypto';

import { createIdentityRepository } from '@flowboard/database';
import { Redis } from 'ioredis';

import { RedisConnectionOptions } from '../common/config/redis.config.js';
import { ApiException } from '../common/errors/api-exception.js';

import type { AuthSettings } from './config/auth.config.js';

export const AuthRuntimeKey = Symbol('AuthRuntime');

const counter =
  "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end; return {n,redis.call('PTTL',KEYS[1])}";
export function createAuthRuntime(databaseUrl: string, redisUrl: string, settings: AuthSettings) {
  const identities = createIdentityRepository(databaseUrl);
  const redis = new Redis(redisUrl, { ...RedisConnectionOptions });
  redis.on('error', () => undefined);
  return {
    identities,
    settings,
    async limit(kind: 'login' | 'signup' | 'refresh' | 'logout', ip: string, email: string) {
      const hash = (text: string) => createHash('sha256').update(text).digest('hex');
      const policies =
        kind === 'signup'
          ? [[hash(ip), 10, 3_600_000] as const]
          : kind === 'login'
            ? [[hash(ip), 100, 900_000] as const, [hash(`${ip}:${email}`), 10, 900_000] as const]
            : [[hash(ip), 120, 60_000] as const];
      for (const [key, maximum, window] of policies) {
        let result: unknown;
        try {
          result = await redis.eval(counter, 1, `flowboard:auth:${kind}:${key}`, window);
        } catch {
          throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Authentication service unavailable');
        }
        if (
          !Array.isArray(result) ||
          typeof result[0] !== 'number' ||
          typeof result[1] !== 'number' ||
          !Number.isFinite(result[1]) ||
          result[1] < 0
        )
          throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Authentication service unavailable');
        if (result[0] > maximum)
          throw new ApiException(
            429,
            'RATE_LIMITED',
            'Too many authentication attempts',
            undefined,
            Math.max(1, Math.min(window / 1000, Math.ceil(Number(result[1]) / 1000))),
          );
      }
    },
    async close() {
      redis.disconnect();
      await identities.close();
    },
  };
}

export type AuthRuntime = ReturnType<typeof createAuthRuntime>;
