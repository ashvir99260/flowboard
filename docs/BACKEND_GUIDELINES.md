# Backend structure and coding rules

Status: adopted repository rules, 23 October 2026 (D85/P02-05). P02-16/D96 adapts the requested core/modules/shared structure with Express, superseding P02-13/D93 foundation paths. Auth/platform remain flat (D89), with colocated tests (D90) and grouped DTOs (D92). The modules below are implemented; the abbreviated tree illustrates their current organization. See the task evidence for verification. Product behavior remains defined by [the plan](PLAN.md), [API catalog](API_CATALOG.md), [backend contracts](BACKEND_CONTRACTS.md) and [field reference](FIELD_REFERENCE.md).

## Basis and scope

The requested [Encore NestJS structure guide](https://encore.dev/articles/nestjs-project-structure-best-practices) recommends grouping related code by feature, limiting module exports, separating transport DTOs from persistence, and keeping HTTP controllers thin. Flowboard adopts those organizational principles. The later [feature-first NestJS article by Rahmouni Oussama](https://medium.com/@rahmounidev/architecting-a-scalable-nestjs-application-with-a-feature-first-approach-092234485a51) adds the core/modules/shared organization adopted in D96. These articles are design references; repository rules and the fixed stack govern implementation.

| Article guidance            | Flowboard rule                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Feature folders             | One folder per domain under `apps/api/src/modules/`; no app-wide controllers/services/DTOs directories.                    |
| Module encapsulation        | Explicit Nest imports/providers/exports; only expose capabilities another feature needs.                                   |
| Shared/core concerns        | Use `core/{common,config,utils}` for foundations, `modules/` for features and `shared/` for reusable Nest providers (D96). |
| DTOs separate from entities | Shared Zod contracts → local `createZodDto` adapters → explicit safe responses; Prisma stays in `packages/database`.       |
| Unit and end-to-end tests   | Colocate auth/platform `.mjs` suites by feature, with explicit discovery and isolated integration fixtures (D90).          |

Retain Flowboard's Prisma package, Zod validation, cursor-only pagination, sanitized Pino logging and typed error envelope. The references' database-in-API, class-validator, offset-pagination and alternate platform examples do not replace these decisions. The user explicitly selected Express in place of the Medium article's Fastify adapter.

## Folder ownership

Use feature names from the domain: `auth`, `workspaces`, `permissions`, `hierarchy`, `statuses`, `fields`, `tasks`, `activity`, `realtime`, `outbox`. Add only folders that have an implemented responsibility. A resource does not need a separate Nest module for every table.

The following is an abbreviated current layout; use nearby source files when extending a feature:

```text
apps/api/
├── AGENTS.md
├── src/
│   ├── main.ts                       # process entry
│   ├── application.ts                # shared HTTP application setup
│   ├── app.module.ts                 # module composition
│   ├── spec-bootstrap.ts             # same controllers, isolated spec providers
│   ├── core/                         # foundations; no shared/feature imports
│   │   ├── config/
│   │   │   ├── application.config.ts
│   │   │   └── redis.config.ts
│   │   ├── utils/
│   │   │   └── read-boolean-setting.ts
│   │   └── common/
│   │       ├── decorators/
│   │       ├── dto/                  # error and empty-query adapters
│   │       ├── errors/
│   │       ├── filters/
│   │       ├── tokens/logger.token.ts
│   │       └── swagger/              # shared error/header documentation
│   ├── shared/
│   │   ├── shared.module.ts          # global filter/validation/serialization
│   │   └── logging/
│   │       ├── logging.module.ts
│   │       ├── nest-logger.ts
│   │       └── request-logging.ts
│   └── modules/
│       ├── platform/                 # flat health/probe feature
│       │   ├── platform.module.ts
│       │   ├── health.controller.ts
│       │   ├── dependency-probe.ts
│       │   ├── health.response.dto.ts
│       │   ├── health.integration.spec.mjs
│       │   ├── http.integration.spec.mjs
│       │   └── openapi.unit.spec.mjs
│       ├── auth/                     # flat auth feature
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── auth.guard.ts
│       │   ├── auth.config.ts        # auth-only settings
│       │   ├── runtime.ts
│       │   ├── cookie-policy.ts
│       │   ├── auth.request.dto.ts
│       │   ├── auth.response.dto.ts
│       │   ├── auth-config.unit.spec.mjs
│       │   ├── auth-guard.unit.spec.mjs
│       │   ├── credentials.integration.spec.mjs
│       │   ├── refresh.integration.spec.mjs
│       │   └── outage.integration.spec.mjs
│       └── workspaces/               # workspace membership and invitation feature
│           ├── workspaces.module.ts
│           ├── workspaces.controller.ts
│           ├── workspaces.service.ts
│           ├── workspaces.request.dto.ts
│           └── workspaces.response.dto.ts
└── test/
    ├── bootstrap/                    # Node startup/process tests
    ├── common/                       # per-suite setup and shared fixtures
    ├── unit/                         # config, lifecycle, logging and helper suites
    └── integration/                  # shared HTTP integration suites
packages/
├── contracts/src/                    # shared schemas, types, pure logic
├── database/                         # Prisma, migrations, scoped persistence
├── openapi/                          # exported document and drift checks
└── api-client/src/generated/         # generated SDK/types/query options
```

Domain modules live in `src/modules/`; AppModule composes SharedModule, infrastructure and the implemented auth, workspace, permission, hierarchy, status, field, task, activity, outbox and realtime modules. Reusable configuration and pure helpers live in `src/core/config/` and `src/core/utils/`. SharedModule and logging providers live in `src/shared/`; `src/core/common/` retains HTTP helpers and the shared logger injection token. Auth-specific configuration remains in `modules/auth/auth.config.ts`. Auth and platform have no source subfolders (D89/D96). Auth/platform tests live directly beside their source, with `.unit.spec.mjs` and `.integration.spec.mjs` suffixes distinguishing purpose (D90). They still consume the compiled ESM application. Do not create empty future features, dummy providers or re-export shims just to resemble the tree.

Keep DTO classes together by feature and request/response role (D92). Auth uses `auth.request.dto.ts` for signup/login/empty-body inputs and `auth.response.dto.ts` for sessions; health uses `health.response.dto.ts` for liveness/readiness outputs. These files sit beside their controllers without subfolders. The existing features also group request/response adapters beside their controllers. Add a focused subfolder only when real complexity justifies it; do not create a default folder per class. Other features may add `mappers/` or `entities/` only when real mapping or an API-internal plain read model needs a separate file. An API `entities/` folder must not contain a Prisma client, ORM decorators or a second copy of persisted models. Reuse the narrow read models exported by the database package where suitable.

## Modules and dependency injection

Each new feature has one Nest module owning its controllers and providers. `AppModule` composes feature modules. Keep authentication guard wiring, shared validation/serialization, exception handling and resource cleanup registered once. Providers that own connections close them on shutdown. The spec-only bootstrap uses the same controller/module graph with isolated providers; it must neither connect to services nor start listeners.

Use constructor injection for services. A consumer imports the owning module and references its exported provider; importing a TypeScript class alone does not register it with Nest. Export only deliberately shared services or injection tokens, never all controllers/providers by default. These boundaries follow [Nest module encapsulation](https://docs.nestjs.com/modules).

Avoid cycles: move orchestration to the feature responsible for the use case, or extract genuinely shared pure logic to contracts. Do not add `forwardRef()` as a routine workaround. Keep global modules exceptional and justified by a real cross-cutting lifecycle need. Dependencies point toward foundations: features may consume shared/core, shared may consume core, and core cannot consume shared/features. Shared ESLint enforces these directions for resolved imports, including type imports, re-exports, dynamic imports, file URLs and configured aliases. Injection tokens belong in core when both layers consume them; their providers remain in shared. No empty CoreModule is needed. Shared modules must have actual consumers, and core helpers must not own domain state. Avoid a pass-through module that only re-exports all features.

## Creating an API feature

1. Choose the domain owner under `apps/api/src/modules/<feature>/`. Extend an existing owner when the use case belongs there; do not create one module per database table. Keep auth/platform flat, with no per-class subfolders.
2. Define or reuse public Zod schemas in `packages/contracts`. Put schema-derived request/path/query DTO classes in `<feature>.request.dto.ts` and response classes in `<feature>.response.dto.ts`, beside the controller. Every DTO file ends in `.dto.ts`; exported class names end in `Dto`. Group related classes by role rather than creating a file per class.
3. Add `<feature>.controller.ts`, `<feature>.service.ts` and `<feature>.module.ts` only for real responsibilities. The controller owns HTTP/Swagger; the service orchestrates the use case; tenant persistence stays in `packages/database`. Use central guards, errors and serialization, with explicit authorization metadata on routes.
4. Declare controllers/providers in the feature's `@Module`. Import the modules supplying injected dependencies and export only capabilities needed by other features. Follow the existing runtime factory pattern when dependencies are supplied at bootstrap; do not create another Prisma client, connection pool or global module.
5. Register the feature through [AppModule.forProbe](../apps/api/src/app.module.ts). Runtime and [spec bootstrap](../apps/api/src/spec-bootstrap.ts) share [createApplication](../apps/api/src/application.ts); the metadata-only path must work without connecting to PostgreSQL/Redis or starting listeners.
6. Add colocated `.unit.spec.mjs` or `.integration.spec.mjs` tests according to [test-file rules](#test-file-rules). Use shared factories in `test/common` and close owned app/container resources, including failed setup. Never share mutable fixture state across suites.
7. Complete the [DTO/Swagger/client checklist](#dtos-swagger-and-generated-clients): operationId, typed responses, descriptions/examples, spec/client regeneration and tests. Run the normal root gates and applicable contract checks before committing.

The existing [tasks module](../apps/api/src/modules/tasks/tasks.module.ts), [request DTO group](../apps/api/src/modules/tasks/tasks.request.dto.ts) and [response DTO group](../apps/api/src/modules/tasks/tasks.response.dto.ts) are concrete examples. Shared error/empty-query DTOs stay in `core/common/dto`; this exception does not make a shared folder the owner of feature contracts.

## HTTP adapter

The shared `createApplication` factory passes an explicit [GracefulExpressAdapter](../apps/api/src/core/common/graceful-express-adapter.ts) to NestFactory. It extends Nest's ExpressAdapter to bound connection draining during shutdown. Both runtime and isolated spec generation use this factory, preserving one controller/provider graph. This follows the [Nest HTTP adapter API](https://docs.nestjs.com/faq/http-adapter). Express parser limits, cookie responses, CORS, error handling and shutdown remain covered by existing integration tests; the HTTP suite also checks the concrete adapter and its type. No Fastify dependency or alternate bootstrap is introduced.

## Controller, service and persistence responsibilities

| Layer                               | Owns                                                                                                  | Does not own                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Controller                          | Route/status, DTO inputs, guard metadata, Swagger, call to service, typed output                      | Business policy, raw SQL, Prisma, inline tenant filters                                |
| Feature service                     | Use case, shared domain validation, permission-aware transaction orchestration, safe response mapping | Connection construction, duplicate authorization rules, arbitrary HTTP error envelopes |
| PermissionGuard / PermissionService | Central resource policy and access metadata                                                           | A separate policy copy per controller                                                  |
| Database package                    | Raw Prisma/SQL, tenant-scoped repositories, locks, relation checks, atomic persistence                | Nest request objects or public response serialization                                  |
| Contracts                           | Pure Zod shapes, enums, deterministic status/field resolution                                         | Nest, Prisma, environment access or side effects                                       |
| Core                                | HTTP helper implementations/tokens, reusable configuration and pure utilities                         | Feature services, shared providers or domain state                                     |
| Shared                              | Reusable provider implementations and global filter/validation/serialization composition              | Feature imports, domain policy or duplicate provider lifecycle                         |
| Platform                            | Health endpoints, dependency probes and their lifecycle                                               | Business rules or auth-specific settings                                               |

Services orchestrate mutations using transaction-bound repositories: lock, re-read current membership/access/configuration, validate all relations, write changes and required outbox events, then commit. Never publish before commit. Authentication uses the narrow global identity repository; tenant features use verified tenant context. Preserve 401/403/404 distinctions and the global `{ error: { code, message, details? } }` envelope.

Prisma/PostgreSQL connections belong to the database package. Redis connections may be owned by API runtime providers (as in the existing auth runtime and dependency probe) with explicit cleanup; feature controllers/services consume injected capabilities rather than opening per-request connections.

Controllers return deliberate response DTO projections. Never return complete database rows, ORM models or an entity merely because its current fields look safe. Password hashes, refresh digests, lease/internal error fields and private columns must stay out of the wire response and the generated spec. See [response projections](BACKEND_CONTRACTS.md#5-response-projections-and-audit-fields).

## DTOs, Swagger and generated clients

Follow this order for every endpoint, including its first implementation:

1. Define strict request/path/query/response schemas in `packages/contracts`, using shared field primitives and cursor pagination. Add schema/model/field titles, descriptions and valid examples with Zod `.meta()`; keep secrets synthetic and password fields write-only.
2. In the owning feature, extend `createZodDto` using those schemas. Use the flat `<feature>.request.dto.ts` and `<feature>.response.dto.ts` groups by default, including auth/platform. Add a DTO subfolder only for demonstrated complexity in a feature that permits subfolders; retain `.dto.ts` suffixes. Use focused names such as `CreateInvitationDto`, `MemberParamsDto`, `MemberPageQueryDto`, `MemberResponseDto` and `MemberPageResponseDto`. Do not repeat properties with `@ApiProperty` or introduce parallel class-validator rules.
3. Keep HTTP decorators near the controller method: verb/path, explicit status, guard metadata, and `@ApiOperation` with a unique stable `operationId`, `summary` and `description`. Describe path/query/header semantics and request-body examples. Security decorators describe the actual guard requirements; they do not enforce access themselves.
4. Use `@ZodResponse` with the concrete response DTO and success status. Keep global `ZodValidationPipe`, `ZodSerializerInterceptor` and sanitized exception filtering. Any supplemental `@ApiResponse` for a payload must retain its concrete `type: ResponseDto.Output`; include description, example and applicable headers. No `Object`, `any` or implicit generic page schema.
5. Describe relevant typed error responses through the existing platform helper and feature-specific cases. Schema references in custom `@ApiBody` metadata use `getSchemaPath` and registered models, not duplicated inline shapes. A 204 response has a description and applicable headers but no content/body example. Cookie/header examples must match the runtime policy.
6. Keep common error/header documentation in `core/common/swagger/api-documentation.ts`. Feature-specific repeated documentation may live beside its controller. Do not hide runtime behavior or typed response checking inside a generic decorator factory.
7. Add success, invalid-input, permission/tenant and relevant race tests. Validate examples against contracts and retain concrete schema references in exported-document tests. Run `pnpm gen:api` and `pnpm openapi:check`; generated client checks run in the build/tests. Never hand-edit OpenAPI or generated client files.

The existing [auth controller](../apps/api/src/modules/auth/auth.controller.ts), [contract schemas](../packages/contracts/src/auth.ts) and [documentation regressions](../packages/openapi/test/documentation.test.mjs) show the implemented conventions. The module and DTO file split preserves the exported OpenAPI contract. The [nestjs-zod reference](https://github.com/BenLorantfy/nestjs-zod) and [Nest operation decorators](https://docs.nestjs.com/openapi/operations) explain the underlying integration.

## Coding and tests

Separate each export statement/declaration from the next statement with one blank line. This includes exported constants, types, interfaces, functions, classes, re-exports and NestJS module classes. Put the blank line before the following declaration's decorators, keeping each decorator attached to its class. No extra blank line is needed after the final declaration at EOF. Shared ESLint presets enforce spacing after the Prettier compatibility layer; generated code and JSON are excluded (D87/P02-07).

Use the same [control-flow spacing](CODE_STYLE.md) as the frontend (D97): a blank line after a complete if/else chain, before a return with a preceding statement, and after a return with a following statement. Else clauses and closing braces stay attached; never split a return from its value. Shared ESLint autofix enforces this without changing behavior.

Keep backend filenames in kebab-case with role suffixes (`*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dto.ts`, `*.entity.ts`); classes/types use PascalCase and functions/variables use camelCase. Use native ESM with explicit `.ts` extensions for relative imports in API TypeScript source, public workspace exports and type-only imports. The API-specific `rewriteRelativeImportExtensions` compiler option emits `.js` paths for Node; compiled-output imports in `.mjs` tests and package exports retain their runtime `.js` extensions. NodeNext and verbatim module syntax preserve ESM output; shared lint rejects CommonJS loaders/exports and createRequire bridges (D95). Follow the committed compiler target and supported Node version.

Prefer `const`, destructuring and explicit typed data. Use `let` for actual reassignment. Typed lookup tables suit closed value-to-handler mappings; ordinary conditionals suit validation, authorization and branching that is clearer when read in order. Avoid forced dispatch tables, needless abstraction, swallowed errors and unrelated formatting changes. Validate configuration once at startup, inject the result, and keep credentials/task content out of logs.

Tests consume built ESM output. Use the exact filenames and placement below. Pure contracts tests stay with contracts; persistence tests stay with database. Colocated API tests are excluded from compiler output and Docker context.

### Test-file rules

| Kind              | Required name for new suites              | Placement and purpose                                                                                                                                                              |
| ----------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit              | `<subject>.unit.spec.mjs`                 | Beside the feature; exercises a focused helper, policy or service boundary without real infrastructure. Shared infrastructure suites belong under `test/unit`.                     |
| Integration       | `<subject>.integration.spec.mjs`          | Beside the feature; exercises boundaries between application parts, using real isolated services when the behavior depends on them. Shared suites belong under `test/integration`. |
| Bootstrap/process | `<subject>.test.mjs`                      | `test/bootstrap`; Node's runner verifies startup, environment loading or build/runtime behavior.                                                                                   |
| Fixture/helper    | Descriptive `.mjs`, without a test suffix | `test/common`; reusable factories, with no test hooks or mutable singleton state.                                                                                                  |

For example, [permissions.unit.spec.mjs](../apps/api/src/modules/permissions/permissions.unit.spec.mjs) and [tasks.integration.spec.mjs](../apps/api/src/modules/tasks/tasks.integration.spec.mjs) already follow these rules. Write `.unit.spec.mjs` and `.integration.spec.mjs`, not `.unit.specs`, `.integration.specs`, `.spec.ts` or a misspelled variant. Keep auth/platform suites directly in their flat feature folders.

The current [Jest configuration](../apps/api/jest.config.mjs) accepts `src/**/*.spec.mjs`, `test/unit/**/*.spec.mjs` and `test/integration/**/*.spec.mjs`; Node discovers `test/bootstrap/*.test.mjs`. Six existing shared suites retain their earlier plain `.spec.mjs` names: `test/unit/common/{application-config,cleanup,lifecycle,logging,validation-errors}.spec.mjs` and `test/integration/common/logging.spec.mjs`. They remain discovered; the new naming rule is not a claim that these were renamed or that Jest enforces the unit/integration wording. Renaming them or narrowing discovery needs a separate verified change.

HTTP/domain integration suites use the shared application factory and real isolated services for behavior that depends on them. Infrastructure-only suites may own their fixture directly, while metadata or HTTP plumbing tests may use controlled probes. Do not report a probe-backed test as persistence or tenant-isolation evidence. Each suite closes the resources it owns, including after partial startup failure; close the app before its containers. Outage tests affect only their own fixture. TypeScript test execution would require a separately verified runner change; do not change extensions merely for appearance.

For every implementation task, follow red → green → refactor, then the root build/lint/test gates plus type, format and contract checks as applicable. Consult [quality gates](QUALITY_GATES.md) and record evidence. Shared lint enforces workspace boundaries and the core/shared/feature dependency directions; contract tests cover Swagger. Feature-to-feature domain ownership and lifecycle composition remain review rules, not a claim of complete automated architecture validation.

## Logging boundaries

`shared/logging` owns the injectable logging module, Nest adapter and request middleware. Its shared injection token is defined once in `core/common/tokens/logger.token.ts`, so the core error filter never imports the provider implementation. API services receive the same Pino-backed `@flowboard/logger` facade; database functions accept it as an optional dependency. Production entrypoints create it from `LOG_LEVEL`. Spec export and default test fixtures use a silent instance. Controllers rely on the common request/error events instead of logging request payloads.

Keep Pino behind that shared facade so raw request/error serializers cannot bypass safe metadata. Use static semantic names with `logger.observe('feature.operation', async () => ...)` around an operation. Record completion after awaited transaction resolution. Let the global filter record sanitized HTTP errors. Permission/domain operations and outbox/worker delivery already use this policy. Extend their static event vocabulary only at real boundaries, and record success after the relevant operation commits or completes. Do not invent successful events for deferred behavior. See [LOGGING.md](LOGGING.md) for fields, correlation and debugging.

See [naming conventions](NAMING_CONVENTIONS.md) for source names and enforcement labels, and [the agent map](agents/README.md) for other package responsibilities.
