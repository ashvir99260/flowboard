import 'reflect-metadata';

import { createDatabase, initializeDatabase } from '@flowboard/database';
import { createLogger, readLogLevel } from '@flowboard/logger';

import { createApplication } from './application.ts';
import { readApplicationConfig } from './core/config/application.config.ts';
import { readAuthSettings } from './modules/auth/auth.config.ts';
import { createAuthRuntime } from './modules/auth/runtime.ts';
import { runtimeProbe } from './modules/platform/dependency-probe.ts';

import type { Server } from 'node:http';

let logger = createLogger({ level: 'info', service: 'api' });
let stage = 'log_config';

async function bootstrap(): Promise<void> {
  logger = createLogger({ service: 'api', level: readLogLevel(process.env.LOG_LEVEL) });
  stage = 'application_config';
  const config = readApplicationConfig(process.env);
  const { databaseUrl, redisUrl } = config;
  stage = 'auth_config';
  const authSettings = readAuthSettings(process.env);
  stage = 'database';
  await initializeDatabase({
    databaseUrl,
    demoSeed: config.demoSeed,
    logger,
    ...(config.directDatabaseUrl ? { directDatabaseUrl: config.directDatabaseUrl } : {}),
  });
  stage = 'application';
  const { app } = await createApplication(runtimeProbe(databaseUrl, redisUrl, logger), {
    auth: createAuthRuntime(databaseUrl, redisUrl, authSettings, logger),
    database: createDatabase(databaseUrl, logger),
    exposeDocs: config.exposeDocs,
    realtime: { redisUrl },
    logger,
  });
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  try {
    stage = 'listen';
    await app.listen(config.port, config.host);
  } catch (error) {
    await app.close();
    throw error;
  }
  const server: Server = app.getHttpServer();
  server.once('close', () => logger.info('api.stopped'));
  const address = server.address();
  if (address && typeof address !== 'string') logger.info('api.started', { port: address.port });
}

bootstrap().catch(() => {
  logger.fatal('api.startup.failed', { operation: stage, code: 'STARTUP_FAILED' });
  process.exitCode = 1;
});
