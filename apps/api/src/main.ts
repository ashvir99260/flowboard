import 'reflect-metadata';

import { initializeDatabase } from '@flowboard/database';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer between 0 and 65535');
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
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
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required');
  }
  // TODO(P01-02): The real HTTP platform requires dependencies in every mode;
  // the empty development shell remains available for its bootstrap test.
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  await app.listen(port, process.env.HOST ?? '127.0.0.1');
  console.info(`[api] Listening at ${await app.getUrl()}`);
}

bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'API startup failed');
  process.exitCode = 1;
});
