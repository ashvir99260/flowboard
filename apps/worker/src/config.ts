export class WorkerConfigError extends Error {
  constructor(readonly code: 'INVALID_PORT' | 'INVALID_CONFIG') {
    super('Invalid worker configuration');
  }
}

export function readWorkerConfig(env: NodeJS.ProcessEnv) {
  const port = Number(env.PORT ?? 3002);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new WorkerConfigError('INVALID_PORT');

  const databaseUrl = env.DATABASE_URL;
  const redisUrl = env.REDIS_URL;
  try {
    if (
      !databaseUrl ||
      !redisUrl ||
      !['postgres:', 'postgresql:'].includes(new URL(databaseUrl).protocol) ||
      !['redis:', 'rediss:'].includes(new URL(redisUrl).protocol)
    )
      throw new Error('Invalid URLs');
  } catch {
    throw new WorkerConfigError('INVALID_CONFIG');
  }

  return { port, databaseUrl, redisUrl, host: env.HOST ?? 'localhost' };
}
