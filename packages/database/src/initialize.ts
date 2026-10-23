import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import pg from 'pg';

import { seedDemoData } from './seed.js';

const execute = promisify(execFile);
const require = createRequire(import.meta.url);

export interface InitializeOptions {
  databaseUrl: string;
  demoSeed?: boolean;
  directDatabaseUrl?: string;
}

export async function initializeDatabase(options: InitializeOptions): Promise<{ seeded: boolean }> {
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
    await lock.connect();
    connected = true;
    // Serialize the whole first boot, including Prisma's migration bookkeeping.
    // Closing this dedicated connection releases the session lock on every path.
    await lock.query('SELECT pg_advisory_lock(706270, 0)');
    await execute(
      process.execPath,
      [
        require.resolve('prisma/build/index.js'),
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
    stage = 'seed';
    const seeded = options.demoSeed === true ? await seedDemoData(databaseUrl) : false;
    if (lockLost) throw new Error('Initialization lock lost');
    return { seeded };
  } catch {
    // Child-process diagnostics may include connection strings; do not log them.
    throw new Error(
      `Database initialization failed during ${stage}; check connectivity and migrations`,
    );
  } finally {
    if (connected) await lock.end().catch(() => undefined);
  }
}
