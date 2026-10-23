import { defineConfig } from 'prisma/config';

const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL'];

// Generation is deliberately independent of runtime credentials or connectivity.
export default defineConfig({
  ...(url ? { datasource: { url } } : {}),
  migrations: { path: 'prisma/migrations' },
  schema: 'prisma/schema.prisma',
});
