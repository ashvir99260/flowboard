import { seedDemoData } from './seed.js';

async function main() {
  if (process.env['DEMO_SEED'] !== 'true') throw new Error('Set DEMO_SEED=true to seed demo data');
  const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is required');
  const seeded = await seedDemoData(url);
  console.info(
    seeded ? 'Demo data created' : 'Demo seed already completed; existing data preserved',
  );
}

main().catch(() => {
  console.error('Demo seed failed; verify explicit demo mode and database configuration');
  process.exitCode = 1;
});
