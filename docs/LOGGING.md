# Backend logging

The API, database boundary and worker share the Pino-backed `@flowboard/logger`. Pino 10.4.0 handles severity filtering, timestamps and JSON serialization; the shared facade limits metadata and carries request context. The API supplies Nest's `LoggerService` adapter. Each stdout line contains one JSON object. There is no external collector, file writer or paid service dependency. Hosted platforms collect stdout; log retention and access belong to deployment configuration. User/workspace IDs are operational identifiers, so restrict log access and retention.

## Runtime configuration

Set `LOG_LEVEL` to `trace`, `debug`, `info` (default), `warn`, `error`, `fatal` or `silent`. Invalid values fail startup with a safe code. Docker injects the level at runtime, so changing it does not require rebuilding the image. Restart a process to apply a changed level. In Compose:

```sh
LOG_LEVEL=debug docker compose up --build
# In another terminal:
docker compose logs -f api worker
```

For a local API process: `LOG_LEVEL=debug pnpm dev --filter=@flowboard/api`. Silence is useful for isolated tests; a production process configured as silent intentionally suppresses logs. Default spec export and test fixtures do not write logs.

## Events and levels

| Level | Current use                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------- |
| trace | Nest verbose framework events, with message content discarded                                                             |
| debug | HTTP start, healthy health checks, service/Redis/database operation start/completion/failure, safe Nest lifecycle markers |
| info  | Successful non-health HTTP completion, API/worker start/stop, migration and seed outcomes                                 |
| warn  | 4xx validation/auth/permission failures, dependency connection errors                                                     |
| error | 5xx request failure, request abort, database initialization failure                                                       |
| fatal | API/worker startup failure                                                                                                |

A request creates a random UUID, returns it in `X-Request-Id` (also exposed through CORS), and carries it through Node async work. Incoming IDs are deliberately ignored. Completion listeners retain this context even when called outside the original async chain. Auth attaches user/workspace UUIDs only after repository verification; failed login and unverified JWT claims never become identity context. Independent requests cannot overwrite each other's context.

Typical record (synthetic IDs):

```json
{
  "time": "2026-10-23T10:00:00.000Z",
  "level": "info",
  "service": "api",
  "event": "http.completed",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "method": "POST",
  "route": "/v1/auth/login",
  "statusCode": 200,
  "durationMs": 12.4
}
```

`operation` appears on operation events; HTTP completion instead carries `method`, the matched route template, status, duration and outcome. Unmatched/parser requests use `unmatched`; query strings and supplied paths never enter logs. An aborted response produces exactly one error outcome. Health success is debug to avoid idle polling noise. Request errors appear as `http.error` with the sanitized API code and as an HTTP completion; these are separate diagnostic and outcome events.

Database transactions emit completion only after the transaction promise resolves. Failed transactions emit `operation.failed` and rethrow the original error; no commit event is recorded. Identity operations include hashing/queries/transactions without recording their inputs. API service operations and Redis rate-limit operations have separate names. The implemented outbox/worker path records dispatch, queue, delivery, rejection and retry outcomes. Examples include `outbox.event.queued`, `outbox.dispatch.retry`, `activity.event.delivered`, `activity.event.rejected` and `worker.event.failed`. Delivery is logged only after publication and successful completion; retries retain static safe codes. See the [outbox service](../apps/api/src/modules/outbox/outbox.service.ts) and [activity processor](../apps/worker/src/activity.processor.ts).

## Safe logging contract

Only static event/operation/component/code/outcome strings, HTTP method, matched route template, finite nonnegative numbers (duration/status/port), and validated UUID context are retained. Unknown metadata keys are dropped. Do not feed user-controlled strings into the allowed semantic fields. Never pass bodies, responses, email, passwords/hashes, cookies, headers, JWTs, refresh digests, IPs, connection strings, SQL/parameters, Prisma metadata, error messages or stacks. Framework logs retain severity only because their free-form messages can contain unsafe content. Do not enable Prisma query dumping or log entire errors to work around this policy.

A failed synchronous output sink is best effort and cannot replace a business result or exception. This logger is diagnostic, not a durable audit ledger. Domain activity remains a transactional outbox responsibility. No logging package is imported into contracts, UI or browser code.

To diagnose failures, first locate the response's request ID and `http.error` code. With debug enabled, find the last operation start and matching failure. A `database.initialization.failed` record identifies migration/seed stage; a `api.startup.failed` record identifies application config, auth config, database, app creation or listen stage. Inspect the relevant validated configuration and migration in a trusted development environment; do not publish secret-bearing raw driver output. Future feature events must follow this same schema and have tests for their failure boundaries.

The current single stdout destination uses string severity labels for compatibility. Any future multi-target Pino transport must retain numeric severity for target routing. Do not expose raw Pino instances or attach automatic request/error serializers that bypass the safe facade.

Implementation references: [Pino 10.4.0 API](https://github.com/pinojs/pino/blob/v10.4.0/docs/api.md), [Nest custom loggers](https://docs.nestjs.com/techniques/logger), [Node AsyncLocalStorage](https://nodejs.org/docs/latest-v22.x/api/async_context.html). The implementation uses Node22-compatible `run`/`getStore` only.
