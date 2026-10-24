# Database instructions

Follow the root/package rules, [database README](README.md), [model](../../docs/DATABASE_DESIGN.md) and [field reference](../../docs/FIELD_REFERENCE.md).

Prisma/client construction and SQL stay here. Public consumers use narrow repositories, never raw Prisma. Request-facing tenant reads/writes require verified actor/workspace context and fail closed; the global identity repository handles global identity. Internal outbox discovery may scan due events across workspaces; event consumers validate persisted references and scope mutations to the stored workspace. Keep these operational capabilities unavailable as HTTP/domain query shortcuts. Re-check membership, permissions/configuration and every relation inside request transactions. Keep workspace locking, optimistic versions and outbox insertion atomic.

Use checked-in migrations for constraints/indexes/triggers; do not replace them with db push or mutate live data to make tests pass. Preserve audit timestamps, foreign keys and stable IDs. Test against isolated real PostgreSQL, including cross-tenant IDs, revoked access, concurrent writes and rollback. Never use a developer/hosted database as a test fixture or remove user volumes without authorization.
