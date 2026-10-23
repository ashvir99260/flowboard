import 'reflect-metadata';

import { initializeDatabase } from '@flowboard/database';

import { createApplication } from './application.js';
import { runtimeProbe } from './platform/dependency-probe.js';

async function bootstrap(): Promise<void> {
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer between 0 and 65535');
  }
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  if (!redisUrl) throw new Error('REDIS_URL is required');
  if (process.env.API_DOCS && !['true', 'false'].includes(process.env.API_DOCS)) {
    throw new Error('API_DOCS must be true or false');
  }
  {
    if (process.env.DEMO_SEED && !['true', 'false'].includes(process.env.DEMO_SEED)) {
      throw new Error('DEMO_SEED must be true or false');
    }
    await initializeDatabase({
      databaseUrl,
      demoSeed: process.env.DEMO_SEED === 'true',
      ...(process.env.DATABASE_URL_UNPOOLED
        ? { directDatabaseUrl: process.env.DATABASE_URL_UNPOOLED }
        : {}),
    });
  }
  const { app } = await createApplication(runtimeProbe(databaseUrl, redisUrl), {
    exposeDocs:
      process.env.API_DOCS === 'true' ||
      (process.env.API_DOCS === undefined && process.env.NODE_ENV !== 'production'),
  });
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  try {
    await app.listen(port, process.env.HOST ?? '127.0.0.1');
  } catch (error) {
    await app.close();
    throw error;
  }
  console.info(`[api] Listening at ${await app.getUrl()}`);
}

bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'API startup failed');
  process.exitCode = 1;
});
