import 'reflect-metadata';

import { initializeDatabase } from '@flowboard/database';

import { createApplication } from './application.js';
import { readAuthSettings } from './auth/config/auth.config.js';
import { createAuthRuntime } from './auth/runtime.js';
import { readApplicationConfig } from './common/config/application.config.js';
import { runtimeProbe } from './platform/dependency-probe.js';

async function bootstrap(): Promise<void> {
  const config = readApplicationConfig(process.env);
  const { databaseUrl, redisUrl } = config;
  const authSettings = readAuthSettings(process.env);
  await initializeDatabase({
    databaseUrl,
    demoSeed: config.demoSeed,
    ...(config.directDatabaseUrl ? { directDatabaseUrl: config.directDatabaseUrl } : {}),
  });
  const { app } = await createApplication(runtimeProbe(databaseUrl, redisUrl), {
    auth: createAuthRuntime(databaseUrl, redisUrl, authSettings),
    exposeDocs: config.exposeDocs,
  });
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  try {
    await app.listen(config.port, config.host);
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
