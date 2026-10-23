# Backend structure and coding rules

Status: adopted repository rules, 23 October 2026 (D85/P02-05). P02-06 implements the auth/platform/common split and separated tests; P02-09/D89 keeps auth and platform source flat, with colocated feature tests in P02-10/D90. Future workspace files below illustrate conventions, not implemented endpoints. Product behavior remains defined by [the plan](PLAN.md), [API catalog](API_CATALOG.md), [backend contracts](BACKEND_CONTRACTS.md) and [field reference](FIELD_REFERENCE.md).

## Basis and scope

The requested [Encore NestJS structure guide](https://encore.dev/articles/nestjs-project-structure-best-practices) recommends grouping related code by feature, limiting module exports, separating transport DTOs from persistence, and keeping HTTP controllers thin. Flowboard adopts those organizational principles. The article is a design reference; repository rules and the fixed stack govern implementation.

| Article guidance            | Flowboard rule                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Feature folders             | One folder per domain under `apps/api/src/`; no app-wide controllers/services/DTOs directories.                      |
| Module encapsulation        | Explicit Nest imports/providers/exports; only expose capabilities another feature needs.                             |
| Shared/core concerns        | Use `common/` for shared infrastructure/config/utilities; `platform/` owns health and dependency probes (D86).       |
| DTOs separate from entities | Shared Zod contracts → local `createZodDto` adapters → explicit safe responses; Prisma stays in `packages/database`. |
| Unit and end-to-end tests   | Colocate auth/platform `.mjs` suites by feature, with explicit discovery and isolated integration fixtures (D90).    |

The article's TypeORM/class-validator examples, alternate error envelope and Encore migration are not adopted. NestJS, Prisma, Zod, Turborepo, PostgreSQL, Redis and the generated client remain the selected stack.

## Folder ownership

Use feature names from the domain: `auth`, `workspaces`, `permissions`, `hierarchy`, `statuses`, `fields`, `tasks`, `activity`, `realtime`, `outbox`. Add only folders that have an implemented responsibility. A resource does not need a separate Nest module for every table.

The following is a target layout, with workspace files illustrating upcoming P02-03:

```text
apps/api/
├── AGENTS.md
├── src/
│   ├── main.ts                       # process entry
│   ├── application.ts                # shared HTTP application setup
│   ├── app.module.ts                 # module composition
│   ├── spec-bootstrap.ts             # same controllers, isolated spec providers
│   ├── common/
│   │   ├── common.module.ts          # global filter/validation/serialization
│   │   ├── config/                   # application and shared Redis options
│   │   ├── decorators/
│   │   ├── dto/                      # errors and empty-query adapters
│   │   ├── errors/
│   │   ├── filters/
│   │   ├── swagger/                  # shared error/header documentation
│   │   └── utils/                    # small helpers with real consumers
│   ├── platform/                     # health and dependency probes
│   │   ├── platform.module.ts
│   │   ├── health.controller.ts
│   │   ├── dependency-probe.ts
│   │   ├── liveness-response.dto.ts
│   │   ├── readiness-response.dto.ts
│   │   ├── health.integration.spec.mjs
│   │   ├── http.integration.spec.mjs
│   │   └── openapi.unit.spec.mjs
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.guard.ts
│   │   ├── auth.config.ts            # auth-only settings
│   │   ├── runtime.ts
│   │   ├── cookie-policy.ts
│   │   ├── empty-auth-body.dto.ts
│   │   ├── log-in.dto.ts
│   │   ├── sign-up.dto.ts
│   │   ├── session-response.dto.ts
│   │   ├── auth-config.unit.spec.mjs
│   │   ├── auth-guard.unit.spec.mjs
│   │   ├── credentials.integration.spec.mjs
│   │   ├── refresh.integration.spec.mjs
│   │   └── outage.integration.spec.mjs
│   └── workspaces/
│       ├── workspaces.module.ts
│       ├── workspaces.controller.ts
│       ├── workspaces.service.ts
│       └── dto/
│           ├── create-invitation.dto.ts
│           └── member-page-response.dto.ts
└── test/
    ├── bootstrap/                    # Node startup/process tests
    ├── common/                       # per-suite setup and shared fixtures
    ├── unit/                         # common configuration, lifecycle and helper suites
    └── integration/                  # common HTTP integration suites
packages/
├── contracts/src/                    # shared schemas, types, pure logic
├── database/                         # Prisma, migrations, scoped persistence
├── openapi/                          # exported document and drift checks
└── api-client/src/generated/         # generated SDK/types/query options
```

Auth and platform own their modules and focused DTO adapters; AppModule composes those with CommonModule. Shared code stays in `common/`, while auth-specific configuration remains in `auth/auth.config.ts`. Auth and platform have no source subfolders (D89). Auth/platform tests live directly beside their source, with `.unit.spec.mjs` and `.integration.spec.mjs` suffixes distinguishing purpose (D90). They still consume the compiled ESM application. Do not create empty future features, dummy providers or re-export shims just to resemble the tree.

In auth and platform, keep focused request, query and response adapters beside the controllers as `*.dto.ts`; do not add subfolders. Other features may use `dto/` for request, path, query and response adapters. Other features may add `mappers/` or `entities/` only when real mapping or an API-internal plain read model needs a separate file. An API `entities/` folder must not contain a Prisma client, ORM decorators or a second copy of persisted models. Reuse the narrow read models exported by the database package where suitable.

## Modules and dependency injection

Each new feature has one Nest module owning its controllers and providers. `AppModule` composes feature modules. Keep authentication guard wiring, shared validation/serialization, exception handling and resource cleanup registered once. Providers that own connections close them on shutdown. The spec-only bootstrap uses the same controller/module graph with isolated providers; it must neither connect to services nor start listeners.

Use constructor injection for services. A consumer imports the owning module and references its exported provider; importing a TypeScript class alone does not register it with Nest. Export only deliberately shared services or injection tokens, never all controllers/providers by default. These boundaries follow [Nest module encapsulation](https://docs.nestjs.com/modules).

Avoid cycles: move orchestration to the feature responsible for the use case, or extract genuinely shared pure logic to contracts. Do not add `forwardRef()` as a routine workaround. Keep global modules exceptional and justified by a real cross-cutting lifecycle need. Do not add parallel shared/core folders. `common/` contains reusable infrastructure, not domain services or feature state; utilities must have an actual consumer.

## Controller, service and persistence responsibilities

| Layer                               | Owns                                                                                                  | Does not own                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Controller                          | Route/status, DTO inputs, guard metadata, Swagger, call to service, typed output                      | Business policy, raw SQL, Prisma, inline tenant filters                                |
| Feature service                     | Use case, shared domain validation, permission-aware transaction orchestration, safe response mapping | Connection construction, duplicate authorization rules, arbitrary HTTP error envelopes |
| PermissionGuard / PermissionService | Central resource policy and access metadata                                                           | A separate policy copy per controller                                                  |
| Database package                    | Raw Prisma/SQL, tenant-scoped repositories, locks, relation checks, atomic persistence                | Nest request objects or public response serialization                                  |
| Contracts                           | Pure Zod shapes, enums, deterministic status/field resolution                                         | Nest, Prisma, environment access or side effects                                       |
| Common                              | Global error mapping, HTTP validation/serialization, application/Redis config, reusable documentation | Domain services and feature-specific state                                             |
| Platform                            | Health endpoints, dependency probes and their lifecycle                                               | Business rules or auth-specific settings                                               |

Services orchestrate mutations using transaction-bound repositories: lock, re-read current membership/access/configuration, validate all relations, write changes and required outbox events, then commit. Never publish before commit. Authentication uses the narrow global identity repository; tenant features use verified tenant context. Preserve 401/403/404 distinctions and the global `{ error: { code, message, details? } }` envelope.

Prisma/PostgreSQL connections belong to the database package. Redis connections may be owned by API runtime providers (as in the existing auth runtime and dependency probe) with explicit cleanup; feature controllers/services consume injected capabilities rather than opening per-request connections.

Controllers return deliberate response DTO projections. Never return complete database rows, ORM models or an entity merely because its current fields look safe. Password hashes, refresh digests, lease/internal error fields and private columns must stay out of the wire response and the generated spec. See [response projections](BACKEND_CONTRACTS.md#5-response-projections-and-audit-fields).

## DTOs, Swagger and generated clients

Follow this order for every endpoint, including its first implementation:

1. Define strict request/path/query/response schemas in `packages/contracts`, using shared field primitives and cursor pagination. Add schema/model/field titles, descriptions and valid examples with Zod `.meta()`; keep secrets synthetic and password fields write-only.
2. In the owning feature, extend `createZodDto` using those schemas. Place auth/platform DTO files directly in the feature directory; other features may group them in `dto/`. Use focused names such as `CreateInvitationDto`, `MemberParamsDto`, `MemberPageQueryDto`, `MemberResponseDto` and `MemberPageResponseDto`. Do not repeat properties with `@ApiProperty` or introduce parallel class-validator rules.
3. Keep HTTP decorators near the controller method: verb/path, explicit status, guard metadata, and `@ApiOperation` with a unique stable `operationId`, `summary` and `description`. Describe path/query/header semantics and request-body examples. Security decorators describe the actual guard requirements; they do not enforce access themselves.
4. Use `@ZodResponse` with the concrete response DTO and success status. Keep global `ZodValidationPipe`, `ZodSerializerInterceptor` and sanitized exception filtering. Any supplemental `@ApiResponse` for a payload must retain its concrete `type: ResponseDto.Output`; include description, example and applicable headers. No `Object`, `any` or implicit generic page schema.
5. Describe relevant typed error responses through the existing platform helper and feature-specific cases. Schema references in custom `@ApiBody` metadata use `getSchemaPath` and registered models, not duplicated inline shapes. A 204 response has a description and applicable headers but no content/body example. Cookie/header examples must match the runtime policy.
6. Keep common error/header documentation in `common/swagger/api-documentation.ts`. Feature-specific repeated documentation may live beside its controller. Do not hide runtime behavior or typed response checking inside a generic decorator factory.
7. Add success, invalid-input, permission/tenant and relevant race tests. Validate examples against contracts and retain concrete schema references in exported-document tests. Run `pnpm gen:api` and `pnpm openapi:check`; generated client checks run in the build/tests. Never hand-edit OpenAPI or generated client files.

The existing [auth controller](../apps/api/src/auth/auth.controller.ts), [contract schemas](../packages/contracts/src/auth.ts) and [documentation regressions](../packages/openapi/test/documentation.test.mjs) show the implemented conventions. The module and DTO file split preserves the exported OpenAPI contract. The [nestjs-zod reference](https://github.com/BenLorantfy/nestjs-zod) and [Nest operation decorators](https://docs.nestjs.com/openapi/operations) explain the underlying integration.

## Coding and tests

Separate each export statement/declaration from the next statement with one blank line. This includes exported constants, types, interfaces, functions, classes, re-exports and NestJS module classes. Put the blank line before the following declaration's decorators, keeping each decorator attached to its class. No extra blank line is needed after the final declaration at EOF. Shared ESLint presets enforce spacing after the Prettier compatibility layer; generated code and JSON are excluded (D87/P02-07).

Keep backend filenames in kebab-case with role suffixes (`*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dto.ts`, `*.entity.ts`); classes/types use PascalCase and functions/variables use camelCase. Match the existing ESM setup: explicit `.js` extensions for relative runtime imports, public workspace exports and type-only imports where appropriate. Follow the committed compiler target and supported Node version; do not switch module systems or enable untested language/runtime features for style.

Prefer `const`, destructuring and explicit typed data. Use `let` for actual reassignment. Typed lookup tables suit closed value-to-handler mappings; ordinary conditionals suit validation, authorization and branching that is clearer when read in order. Avoid forced dispatch tables, needless abstraction, swallowed errors and unrelated formatting changes. Validate configuration once at startup, inject the result, and keep credentials/task content out of logs.

Tests consume built ESM output. Colocate auth/platform suites directly in their feature folders as `.unit.spec.mjs` and `.integration.spec.mjs`. Jest discovers `src/**/*.spec.mjs` together with retained common suites in `test/unit/**/*.spec.mjs` and `test/integration/**/*.spec.mjs`; Node's runner discovers `test/bootstrap/*.test.mjs`. `test/common/` contains helper modules only, with no test hooks or mutable singleton state. Each integration suite calls the shared application factory to own independent PostgreSQL/Redis containers, and closes the app before containers, including partial-start failure cleanup. Outage tests affect only their own fixture. The supported colocated format is `.mjs`, not `.spec.ts`; TypeScript tests require a separately verified runner change. Colocated tests are excluded from compiler output and Docker context. Pure contracts tests stay with contracts; persistence tests stay with database.

For every implementation task, follow red → green → refactor, then the root build/lint/test gates plus type, format and contract checks as applicable. Consult [quality gates](QUALITY_GATES.md) and record evidence. These folder/module conventions are review rules today; existing lint enforces package/import boundaries and existing contract tests cover Swagger. No new automatic intra-API feature-boundary checker is claimed by this document.

## Logging boundaries

`common/logging` owns the injectable logging module, Nest adapter and request middleware. API services receive the same Pino-backed `@flowboard/logger` facade; database functions accept it as an optional dependency. Production entrypoints create it from `LOG_LEVEL`. Spec export and default test fixtures use a silent instance. Controllers rely on the common request/error events instead of logging request payloads.

Keep Pino behind that shared facade so raw request/error serializers cannot bypass safe metadata. Use static semantic names with `logger.observe('feature.operation', async () => ...)` around an operation. Record completion after awaited transaction resolution. Let the global filter record sanitized HTTP errors. Add future permission/resolution/outbox/queue events where those real features are implemented, following the same policy; do not invent successful events for deferred behavior. See [LOGGING.md](LOGGING.md) for fields, correlation and debugging.
