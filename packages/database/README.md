# Database workspace

Prisma owns the 15 PostgreSQL models in `prisma/schema.prisma`. The checked-in migration also owns the composite tenant foreign keys, CHECK constraints, current refresh-family index and audit triggers. Use migrations; `db push` does not reproduce those SQL protections.

`pnpm --filter @flowboard/database build` generates the internal client and compiles it. This needs no database or environment secrets. The generated source is ignored by Git, lint and formatting, and is regenerated in Docker builds. Consumers import the package's public entry point; raw Prisma is deliberately not exported.

To apply migrations to your chosen local database, export `DATABASE_URL_UNPOOLED` (preferred) or `DATABASE_URL`, then run `pnpm --filter @flowboard/database db:migrate`. On Neon, use a direct connection for migrations and the pooled connection for normal runtime queries. Never point tests at either environment.

`pnpm --filter @flowboard/database test` needs a running Docker daemon. It starts a uniquely named PostgreSQL 17 container with an ephemeral localhost port, applies the real migration, tests rejected writes and Prisma operations, restarts PostgreSQL, reapplies the migration, and removes only that container. It never reads your database URL and fails if Docker is unavailable. Root `pnpm test` includes this suite.

Database constraints enforce row shape and same-tenant relationships. The repository boundary also validates node parent type. These checks do not replace services for permissions, effective status sets or custom-field values. Seed-once initialization runs migrations before inserting the explicitly enabled demo under initialization/transaction locks. Set DEMO_SEED=true only for the local demo; subsequent runs preserve edits. `pnpm db:migrate` and `pnpm db:seed` provide the root operational commands.

`createDatabase(url)` exposes `read(context, callback)`, `write(context, callback)` and `close()`. Context contains only verified `actorUserId` and `workspaceId`; supplying a role is rejected. Each operation reloads membership. Reads use a consistent, read-only snapshot; writes lock the workspace first and reload membership at Read Committed isolation. A waiting write therefore observes a membership revocation committed by the previous lock holder. Callback handles expire when the transaction closes.

The initial typed storage repositories cover nodes, member lookup and grants. They inject the workspace on every query and reject arbitrary Prisma filters, nested mutations or caller-supplied workspace fields. Node pages use an internal ID anchor; API cursor signing, public ordering, permission checks, revision increments and outbox orchestration belong to later use cases. No task mutation primitive is exposed. `createIdentityRepository(url)` is the narrow global identity exception. It hashes/verifies credentials internally, atomically registers users/workspaces/defaults/sessions, locks User before opening login families, and returns explicit safe entities. Authentication binds user, current family and selected workspace and reloads the membership role. No method accepts an acting role or exports password hashes.

Prisma 7 uses `prisma.config.ts` for connection URLs and a driver adapter at runtime. Its schema-diff engine currently also requires a URL for an offline datamodel diff. Supply one explicitly to that development command; no fallback connection string is built into the runtime configuration.

Refresh and logout serialize on User, re-read credentials after locking and use the database clock. Refresh consumption/replacement/linking is atomic; replay commits family revocation before the API sends401. Only digests cross the persistence boundary, and replacement rows retain the original family expiry.
