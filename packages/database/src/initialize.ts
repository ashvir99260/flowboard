import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { SilentLogger } from '@flowboard/logger';
import pg from 'pg';

import { seedDemoData } from './seed.js';

import type { Logger } from '@flowboard/logger';

const execute = promisify(execFile);

export interface InitializeOptions {
  databaseUrl: string;
  demoSeed?: boolean;
  directDatabaseUrl?: string;
  logger?: Logger;
}

export async function initializeDatabase(options: InitializeOptions): Promise<{ seeded: boolean }> {
  const logger = options.logger ?? SilentLogger;
  const databaseUrl = options.directDatabaseUrl ?? options.databaseUrl;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const lock = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 60_000,
  });
  let lockLost = false;
  let connected = false;
  lock.on('error', () => {
    lockLost = true;
  });
  let stage = 'migration';
  try {
    logger.info('database.initialization.started', { component: 'database', operation: stage });
    await lock.connect();
    connected = true;
    // Serialize the whole first boot, including Prisma's migration bookkeeping.
    // Closing this dedicated connection releases the session lock on every path.
    await lock.query('SELECT pg_advisory_lock(706270, 0)');
    await execute(
      process.execPath,
      [
        fileURLToPath(import.meta.resolve('prisma/build/index.js')),
        'migrate',
        'deploy',
        '--config',
        fileURLToPath(new URL('../prisma.config.ts', import.meta.url)),
      ],
      {
        env: {
          ...process.env,
          CHECKPOINT_DISABLE: '1',
          DATABASE_URL: databaseUrl,
          DATABASE_URL_UNPOOLED: databaseUrl,
        },
        maxBuffer: 1024 * 1024,
        timeout: 60_000,
      },
    );
    if (lockLost) throw new Error('Initialization lock lost');
    logger.info('database.migration.completed', { component: 'database' });
    stage = 'seed';
    const seeded = options.demoSeed === true ? await seedDemoData(databaseUrl) : false;
    if (lockLost) throw new Error('Initialization lock lost');
    logger.info('database.initialization.completed', {
      component: 'database',
      outcome: seeded ? 'seeded' : 'unchanged',
    });
    return { seeded };
  } catch {
    logger.error('database.initialization.failed', {
      component: 'database',
      operation: stage,
      code: 'INITIALIZATION_FAILED',
    });
    // Child-process diagnostics may include connection strings; do not log them.
    throw new Error(
      `Database initialization failed during ${stage}; check connectivity and migrations`,
    );
  } finally {
    if (connected) await lock.end().catch(() => undefined);
  }
}
