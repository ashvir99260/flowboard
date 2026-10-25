import { readBooleanSetting } from '../utils/read-boolean-setting.ts';

function readDocsBasePath(value: string | undefined): '/' | '/api' {
  if (value === undefined || value === '/') return '/';

  if (value === '/api') return '/api';

  throw new Error('API_DOCS_BASE_PATH must be / or /api');
}

export function readApplicationConfig(environment: NodeJS.ProcessEnv) {
  const port = Number(environment.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('PORT must be an integer between 0 and 65535');

  const databaseUrl = environment.DATABASE_URL;
  const redisUrl = environment.REDIS_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  if (!redisUrl) throw new Error('REDIS_URL is required');

  const docs = readBooleanSetting(environment.API_DOCS, 'API_DOCS');
  const docsBasePath = readDocsBasePath(environment.API_DOCS_BASE_PATH);

  return {
    databaseUrl,
    redisUrl,
    host: environment.HOST ?? 'localhost',
    port,
    demoSeed: readBooleanSetting(environment.DEMO_SEED, 'DEMO_SEED') ?? false,
    docsBasePath,
    exposeDocs: docs ?? environment.NODE_ENV !== 'production',
    ...(environment.DATABASE_URL_UNPOOLED
      ? { directDatabaseUrl: environment.DATABASE_URL_UNPOOLED }
      : {}),
  };
}
