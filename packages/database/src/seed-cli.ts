import { createLogger, readLogLevel } from '@flowboard/logger';

import { seedDemoData } from './seed.js';

let logger = createLogger({ level: 'info', service: 'database' });

async function main() {
  logger = createLogger({ service: 'database', level: readLogLevel(process.env['LOG_LEVEL']) });
  if (process.env['DEMO_SEED'] !== 'true') throw new Error('Set DEMO_SEED=true to seed demo data');

  const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is required');

  const seeded = await seedDemoData(url);
  logger.info('database.seed.completed', { outcome: seeded ? 'seeded' : 'unchanged' });
}

main().catch(() => {
  logger.error('database.seed.failed', { code: 'SEED_FAILED' });
  process.exitCode = 1;
});
