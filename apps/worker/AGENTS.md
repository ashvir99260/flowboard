# Worker instructions

Read root instructions, [events](../../docs/api-events.md), [logging](../../docs/LOGGING.md) and the current task.

Consume typed references to committed outbox events through BullMQ. Database owns claims, leases, idempotent activity writes and completion. Validate stored event/job identities; keep tenant context. Delivery can repeat, so preserve deduplication, retry/quarantine behavior and publish-before-complete ordering.

Use the shared Pino facade with static safe metadata, runtime configuration and explicit resource shutdown/readiness. No app-to-app imports or unscoped jobs. Test crashes, duplicates, dependency loss and retries with isolated real Redis/PostgreSQL. Task text search uses the database expression index; do not add an unrequested second indexer.
