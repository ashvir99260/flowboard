# Database workspace

Prisma owns the 15 PostgreSQL models in `prisma/schema.prisma`. The checked-in migration also owns the composite tenant foreign keys, CHECK constraints, current refresh-family index and audit triggers. Use migrations; `db push` does not reproduce those SQL protections.

`pnpm --filter @flowboard/database build` generates the internal client and compiles it. This needs no database or environment secrets. The generated source is ignored by Git, lint and formatting, and is regenerated in Docker builds. Consumers import the package's public entry point; raw Prisma is deliberately not exported.

To apply migrations to your chosen local database, export `DATABASE_URL_UNPOOLED` (preferred) or `DATABASE_URL`, then run `pnpm --filter @flowboard/database db:migrate`. On Neon, use a direct connection for migrations and the pooled connection for normal runtime queries. Never point tests at either environment.

`pnpm --filter @flowboard/database test` needs a running Docker daemon. It starts a uniquely named PostgreSQL 17 container with an ephemeral localhost port, applies the real migration, tests rejected writes and Prisma operations, restarts PostgreSQL, reapplies the migration, and removes only that container. It never reads your database URL and fails if Docker is unavailable. Root `pnpm test` includes this suite.

Database constraints enforce row shape and same-tenant relationships. They do not replace the service checks for permissions, node parent type, effective status sets or custom-field values. Tenant repositories arrive in P01-04; seed-once initialization in P01-05. Those tasks remain unchecked until their behavior is tested.

Prisma 7 uses `prisma.config.ts` for connection URLs and a driver adapter at runtime. Its schema-diff engine currently also requires a URL for an offline datamodel diff. Supply one explicitly to that development command; no fallback connection string is built into the runtime configuration.
