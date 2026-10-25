# Worker instructions

Read root instructions, [events](../../docs/api-events.md), [logging](../../docs/LOGGING.md) and the current task.

Consume typed references to committed outbox events through BullMQ. Database owns claims, leases, idempotent activity writes and completion. Validate stored event/job identities; keep tenant context. Delivery can repeat, so preserve deduplication, retry/quarantine behavior and publish-before-complete ordering.

Use the shared Pino facade with static safe metadata, runtime configuration and explicit resource shutdown/readiness. No app-to-app imports or unscoped jobs. Test crashes, duplicates, dependency loss and retries with isolated real Redis/PostgreSQL. Task text search uses the database expression index; do not add an unrequested second indexer.

Normal worker runtime owns both the shared `@flowboard/jobs` outbox dispatcher and BullMQ activity consumer, including readiness and cleanup. API compatibility exports must not restart production polling in request functions. Follow [run modes](../../docs/RUN_AND_DEPLOY.md): native apps for development, full Compose for preview, temporary Vercel demo, planned ECR production.
