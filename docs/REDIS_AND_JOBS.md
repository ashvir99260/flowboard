# Redis, BullMQ and realtime in Flowboard

Source snapshot: `1ae096b`, 25 October 2026. PostgreSQL is authoritative for tasks, permissions, sessions, outbox intent and activity. Redis provides coordination and transport; it is not the database for boards or a cache of resolved statuses/custom fields.

## Four roles, separate responsibilities

| Role                              | Current name or boundary                                                    | Purpose                                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Auth throttling                   | `flowboard:auth:${kind}:${sha256Key}`                                       | Expiring counters updated atomically with Lua; raw email/IP values are not used as keys.                       |
| BullMQ work queue                 | Queue `flowboard-events`, job `event`, job ID = event UUID                  | Schedule persisted events for the worker. Job payload holds identifiers, not authoritative task content.       |
| Worker → API publication          | Channel `flowboard:events`                                                  | Publish a validated private event envelope to API processes. This is ephemeral Pub/Sub, not replay storage.    |
| Socket.IO horizontal coordination | Adapter prefix `flowboard:socket.io`, peer event `flowboard.internal.event` | Coordinate API instances and authorized browser invalidations. List rooms include both workspace and list IDs. |

The API uses separate connections for publishing/subscribing and event consumption. The worker separates BullMQ's blocking connection from bounded publishing. Redis subscription mode cannot double as an arbitrary command connection. The browser never connects to Redis.

Relevant sources: [job constants](../packages/contracts/src/jobs.ts), [auth limiter](../apps/api/src/modules/auth/runtime.ts), [outbox publisher](../apps/api/src/modules/outbox/outbox.publisher.ts), [worker runtime](../apps/worker/src/activity.worker.ts), [realtime gateway service](../apps/api/src/modules/realtime/realtime.service.ts).

## One task status change, end to end

```mermaid
sequenceDiagram
  participant UI as Browser
  participant API as API transaction and dispatcher
  participant DB as PostgreSQL
  participant Q as Redis and BullMQ
  participant W as Worker
  participant G as API socket gateway
  UI->>API: Authorized task mutation
  API->>DB: Commit task/version and outbox event together
  API-->>UI: Authoritative task response
  API->>DB: Claim due persisted event
  API->>Q: Add event job using stable event ID
  Q->>W: Deliver job, possibly more than once
  W->>DB: Reload/verify event; insert status activity idempotently
  W->>Q: Publish validated private event envelope
  W->>DB: Mark delivery complete after publish
  Q->>G: Event notification
  G->>G: Recheck each recipient's identity and permission
  G-->>UI: Content-free invalidation
  UI->>API: Refetch through generated REST operations
```

A database transaction writes the task mutation, version and outbox row atomically. No event is emitted before commit. The response does not wait for activity delivery; the drawer's activity feed appears asynchronously after the worker processes the event.

The [dispatcher](../apps/api/src/modules/outbox/outbox.service.ts) polls every 500 ms, claims at most 20 due events with 30-second leases and enqueues `{ schemaVersion: 1, eventId, workspaceId }`. PostgreSQL row locking with `SKIP LOCKED` allows competing dispatchers. A successful enqueue marks the event queued for recheck after 30 seconds; it is not considered delivered yet.

BullMQ uses the event UUID as its stable job ID, five attempts and exponential backoff starting at one second. Jobs are removed on completion/failure. Worker concurrency is four. These values come from [outbox configuration](../apps/api/src/modules/outbox/outbox.config.ts), [queue publication](../apps/api/src/modules/outbox/outbox.publisher.ts) and [worker startup](../apps/worker/src/activity.worker.ts); they are implementation defaults, not throughput guarantees.

The [processor](../apps/worker/src/activity.processor.ts) validates job name/ID/schema, claims the stored event, and verifies tenant, aggregate, list and status relationships against PostgreSQL. A `task.updated` status change inserts activity with a unique event identity. An unchanged status or another event type does not fabricate a status-change activity entry. It publishes the validated envelope and only then marks delivery complete.

## Duplicates, outages and recovery

Delivery is **at least once**. A crash after activity insertion but before publication retries without duplicating the activity. A crash after publication but before marking delivery complete can publish again. Stable event IDs, lease-token predicates and idempotent storage make those cases safe; they do not create exactly-once browser delivery.

| Failure                                           | Current behavior                                                                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Redis cannot accept a job                         | Committed task/outbox data remains in PostgreSQL; dispatcher retries.                                                             |
| Queue data is lost or attempts are exhausted      | Undelivered queued rows become due again; PostgreSQL recheck can enqueue them again.                                              |
| Worker crashes or an operation outlives its lease | Expired 30-second claims can be reclaimed. There is no lease heartbeat; duplicates are expected and handled.                      |
| Transient processing/publication error            | Row returns to pending with bounded exponential delay, up to 60 seconds.                                                          |
| Persisted event is invalid                        | Quarantine as failed; do not endlessly publish invalid payloads. Investigate the event and cause before deliberate repair/replay. |
| Subscriber/browser is disconnected                | Pub/Sub does not replay missed messages. Clients resync from REST after reconnect.                                                |
| Auth rate-limit Redis is unavailable              | Auth limiter fails closed with 503. Existing durable task data is unaffected, but this is not full application availability.      |

Do not treat a successful Redis publish as proof that every browser received it. [API recipient filtering](../apps/api/src/modules/realtime/realtime.service.ts) rechecks current membership and list access; room membership alone is not authorization. Internal envelopes can contain private references. Public invalidations contain authorized scope/event identity and optional negotiated `self` metadata, not task content or hidden destination details. The web [realtime provider](../apps/web/src/features/realtime/RealtimeProvider.tsx) deduplicates events and refetches; it does not apply Redis payloads as task records.

## Deployment and environment isolation

Local [Compose](../compose.yaml) runs Redis with append-only persistence, `noeviction`, a named volume and ping health. Hosted queue storage should also retain data and reject writes when memory is exhausted rather than evict queue keys. PostgreSQL replay protects undelivered intent, but losing Redis still interrupts delivery, throttle state and live connections.

Each environment must have its own Redis instance and PostgreSQL database/branch. Queue, channel and auth prefixes are fixed in the current code. Using the same Redis server with different logical database numbers does not isolate Pub/Sub channels. Environment-prefix support would be a separate code change, not a runtime setting that exists today.

Keep Redis private and configure API/worker `REDIS_URL` at process startup. Web does not receive it. The [Render plan](RENDER.md) explains why a free, in-memory-only Key Value service is a limited experiment rather than the proposed durable worker setup.

## Health and operational checks

- API `/health/live` reports process liveness. `/health/ready` checks database and Redis dependencies.
- Worker `/health/ready` also needs an active BullMQ worker and both queue/publish connections. A Render background worker has no incoming network endpoint; use provider process/log monitoring and external functional acceptance rather than claiming Render will call this HTTP path.
- Readiness is not a queue-drained check. Monitor outbox age/count by state, failed/quarantined events, retries, processing latency, worker health and Redis memory.
- The 500 ms dispatcher and database readiness probes generate regular PostgreSQL traffic. Consider this when evaluating Neon suspension/usage; no automatic idle optimization is implemented.
- Test a real status change: REST returns success, one activity is stored, a second authorized client refreshes, and a denied client receives no protected details. Test worker restart and Redis interruption using disposable data.

Task search uses PostgreSQL's live-row expression index, maintained atomically with writes; see [search design](SEARCH.md). The worker does not duplicate that index. This pipeline does not implement outgoing webhooks or email delivery. See [event contracts](api-events.md) for public contracts and separately labeled examples.
