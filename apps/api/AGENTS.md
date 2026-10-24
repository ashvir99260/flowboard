# API instructions

Read the [root instructions](../../AGENTS.md), [backend guide](../../docs/BACKEND_GUIDELINES.md), [naming](../../docs/NAMING_CONVENTIONS.md) and current task.

- Use NestJS with the existing Express `createApplication` factory for runtime and spec export. Features live in `src/modules/<feature>/`; auth/platform remain flat. Group DTOs by feature and request/response role.
- `core/config` owns reusable settings, `core/utils` pure helpers, and `core/common` HTTP infrastructure/tokens. `shared` owns reusable Nest providers. Core cannot import shared/features; shared cannot import features. Lint enforces those directions; DI ownership/cycle review is still required.
- Controllers own transport and decorators; services orchestrate use cases; database owns Prisma/SQL and scoped transactions. Use central auth, permissions, validation, serialization and error handling once. No second bootstrap or duplicate policy.
- Follow the [endpoint contract checklist](../../docs/BACKEND_GUIDELINES.md#dtos-swagger-and-generated-clients) and [API catalog](../../docs/API_CATALOG.md): schema-derived DTOs, explicit operationId/guard metadata, typed responses, titles/descriptions/examples and generated spec/client checks. Do not serialize raw persistence entities.
- Keep Node ESM `.js` imports and type-only imports. Tests use the existing `.mjs` runners and compiled API; colocate feature suites, keep reusable fixture factories in `test/common`, and own/close isolated resources.
- Use the injected Pino facade with static semantic names and safe metadata; see [logging](../../docs/LOGGING.md). Never log free-form request/response/driver/error content or credentials.
- Realtime metadata is negotiated per connection and authorized per recipient. Keep legacy payload compatibility and no task/actor/private-destination leakage; see [events](../../docs/api-events.md).
