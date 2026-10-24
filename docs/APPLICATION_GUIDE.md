# Flowboard application guide

Source snapshot: `3cc62b0`, 25 October 2026. This guide explains what the application contains and how the parts work together. Read [HLD](HLD.md) for system-level decisions, [LLD](LLD.md) for implementation details and [delivery summary](DELIVERY_SUMMARY.md) for requirement coverage and remaining work.

## What a user can do

| Feature              | Current behavior                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account/session      | Sign up or log in, restore a cookie-backed session, choose a workspace and log out. Signup creates an initial workspace.                                       |
| Workspace navigation | Browse only visible spaces/folders/lists in a collapsible sidebar. Roles and grants are workspace-specific.                                                    |
| Board                | See the list's resolved status columns and task metadata. Drag with pointer or keyboard; use an explicit Move dialog for accessible placement or another list. |
| Table                | Use MUI Data Grid with built-in and resolved custom columns. Sort/filter on the server, load cursor pages, and page through loaded rows locally.               |
| Task editor          | Create/edit/archive tasks, edit resolved custom fields, preview safe Markdown and see status-change activity. Invalid saves retain the draft.                  |
| Configuration        | Admins manage scoped status/field definitions and inspect inherited/local previews. Unsafe changes are rejected without discarding the draft.                  |
| Collaboration        | Authorized open clients refetch after edits/moves. Action results and eligible remote changes appear as Toastify notifications.                                |
| API access           | The same operations are available through the typed REST API, Swagger and the executable curl cookbook.                                                        |

The web app does not expose a dedicated screen for every API operation. Workspace/member/invitation/grant/container administration is available through the API where implemented; do not infer management screens from endpoint availability. Invitations are manually shared and accepted through the API: there is no email sender or invitation-acceptance web form. Search is a tracked stub, not a usable feature.

## A normal working session

1. Sign in and select a workspace. The browser restores a short-lived access credential through its refresh cookie; account/workspace changes clear the prior cache, drafts and subscriptions.
2. Select a visible list. Web requests its effective statuses, custom-field schema and task pages. It rejects mixed-scope/revision data instead of showing a partly stale board.
3. Choose Board or List. Both display the same tasks. View/sort/filter are shareable URL state; page cursors are internal implementation state.
4. Open a task, edit fields and save. Required fields, options, dates and types are validated in the form and again by the API. A conflict asks for an explicit reload; it does not silently overwrite a newer task.
5. Move a task. The destination must be visible, the status valid or mappable by category, and required destination fields supplied. A rejected optimistic move rolls back.
6. Another authorized client receives an invalidation and reloads current data. Status changes appear in the activity feed after the worker processes their durable event.

Admins can bypass container visibility inside their own workspace and change configuration. Members can edit visible tasks but cannot administer statuses/fields merely because a container is visible. A private ancestor requires an allow at that ancestor; a descendant allow cannot bypass an ancestor deny.

## Workspace packages

The repository has three apps and twelve shared/tooling packages. Versions and exports are authoritative in each linked `package.json`; this table explains purpose rather than copying a version list that can drift.

| Workspace                                                                | Purpose                                                                                                         | Main consumers                                   |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [apps/web](../apps/web/package.json)                                     | Next.js/React routes, sessions, generated queries, domain form orchestration and browser interactions.          | Browser users.                                   |
| [apps/api](../apps/api/package.json)                                     | NestJS on Express: authentication, REST, permissions, domain services, outbox dispatcher and Socket.IO gateway. | Web and other API clients.                       |
| [apps/worker](../apps/worker/package.json)                               | BullMQ processor: verifies event references, writes activity and publishes invalidations.                       | Committed outbox work.                           |
| [packages/contracts](../packages/contracts/package.json)                 | Framework-free Zod schemas, inferred types, enums, event contracts and pure domain algorithms.                  | API, database, worker, client, UI/forms and web. |
| [packages/database](../packages/database/package.json)                   | Prisma schema/migrations, seed, tenant repositories, transactions and narrow identity operations.               | API and worker.                                  |
| [packages/logger](../packages/logger/package.json)                       | Pino logging, correlation and bounded safe metadata.                                                            | API, database and worker.                        |
| [packages/openapi](../packages/openapi/package.json)                     | Spec-only export, committed OpenAPI and Spectral/drift validation.                                              | Generated client and API readers.                |
| [packages/api-client](../packages/api-client/package.json)               | Generated SDK/types/TanStack options plus session-aware transport setup.                                        | Web and typed API consumers.                     |
| [packages/ui](../packages/ui/package.json)                               | MUI/Emotion theme, presentational components, Data Grid, overlays, safe Markdown and Storybook.                 | Web, forms and component development.            |
| [packages/forms](../packages/forms/package.json)                         | Typed RHF controls, Zod resolver defaults and safe JSON field rendering.                                        | Web forms.                                       |
| [packages/config-typescript](../packages/config-typescript/package.json) | Shared Node/Nest/Next/library compiler presets.                                                                 | All TypeScript workspaces.                       |
| [packages/config-eslint](../packages/config-eslint/package.json)         | Shared lint/commit conventions, import boundaries, dependency-version and readability checks.                   | Repository and workspace checks.                 |
| [packages/config-prettier](../packages/config-prettier/package.json)     | Shared formatting without reordering package manifests.                                                         | Repository and workspace formatting.             |
| [packages/config-jest](../packages/config-jest/package.json)             | ESM Jest presets and isolated test infrastructure/process helpers.                                              | Backend and service tests.                       |
| [packages/release-tools](../packages/release-tools/package.json)         | Dependency-aware release planning, image/release publication and gated preview orchestration.                   | CI/operations only.                              |

Root scripts delegate to Turbo. Apps never import another app; shared packages use public exports. The only deliberate package-to-app exception is the OpenAPI package's build-time spec entry. See [architecture boundaries](../ARCHITECTURE.md#package-boundary-matrix).

## Why these libraries exist

| Library/tool                                         | Job in Flowboard                                                                                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js + React                                      | Routing, server-rendered application shell and interactive browser features.                                                                             |
| MUI + Emotion                                        | Accessible controls, semantic theme and reusable styled composition. The appearance is inspired by headless/shadcn systems while retaining MUI behavior. |
| MUI X Data Grid Community                            | Keyboard-capable, virtualized task table. Its display paginator is separate from API cursor loading.                                                     |
| React Hook Form + Zod resolver                       | Form state, touched/errors, controlled inputs and schema-based validation.                                                                               |
| Zod + nestjs-zod + Nest Swagger                      | Shared validation becomes typed request/response DTOs and an OpenAPI document.                                                                           |
| Hey API + TanStack Query                             | Generate transport/types/query options; cache and coordinate server data without handwritten feature HTTP calls.                                         |
| `@hello-pangea/dnd`                                  | Maintained react-beautiful-dnd family implementation for board drag, keyboard movement and cancellation.                                                 |
| React Toastify                                       | Controlled success/error and remote-change notification presentation.                                                                                    |
| NestJS + Express                                     | Backend feature modules, dependency injection, guards, pipes and HTTP lifecycle.                                                                         |
| Prisma + PostgreSQL                                  | Schema/migrations and transactional authoritative storage. Raw SQL stays inside the database package.                                                    |
| Argon2id + JOSE                                      | Password hashing and signed short-lived access JWTs; opaque refresh credentials are stored as digests.                                                   |
| Redis + BullMQ                                       | Shared queue, pub-sub and retryable asynchronous processing. Redis is not the task source of truth.                                                      |
| Socket.IO + Redis adapter                            | Authenticated client subscriptions and multi-instance invalidation delivery.                                                                             |
| Pino                                                 | Structured backend logs with correlation and secret/content redaction.                                                                                   |
| Storybook + Vitest                                   | Isolated component examples, interactive browser checks and accessibility inspection.                                                                    |
| Jest + Supertest + Node test runner + Playwright/axe | Domain, real-database/API, process, browser and accessibility checks at the appropriate boundaries.                                                      |
| ESLint + Prettier + TypeScript + commitlint          | Import/ownership rules, safe ordering/readability, formatting, types and conventional change history.                                                    |
| Turbo + pnpm + Docker                                | Workspace dependency graph/cache, reproducible dependencies and local multi-process packaging.                                                           |
| Graphify, Serena, ast-grep, Gitleaks and REA         | Optional code navigation, structure/secret checks and explicitly requested artifact inspection. Their generated data stays local/ignored.                |

JSON form configuration is a restricted presentation vocabulary, not executable code or a second validation language. UI components do not fetch data. Graphs and AI tool output help navigation but do not replace source/evidence review.

## Finding code and contracts

| Question                                        | Start here                                                                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Which page/feature handles this interaction?    | [Web app routes](../apps/web/app), [web features](../apps/web/src/features), [frontend guide](FRONTEND_GUIDELINES.md).                    |
| Where does an endpoint live?                    | [API catalog](API_CATALOG.md), then [API modules](../apps/api/src/modules).                                                               |
| Where is a persisted field or relation defined? | [Prisma schema](../packages/database/prisma/schema.prisma), [database design](DATABASE_DESIGN.md), [field reference](FIELD_REFERENCE.md). |
| How are statuses/fields resolved?               | [Shared contracts](../packages/contracts/src), [LLD algorithms](LLD.md#status-and-field-resolution).                                      |
| Where is shared visual behavior?                | [UI source](../packages/ui/src), [component guide](UI_COMPONENT_SYSTEM.md), [Storybook](STORYBOOK.md).                                    |
| How do requests refresh sessions?               | [Client transport](../packages/api-client/src/setup-client.ts), [LLD authentication](LLD.md#authentication-and-session-lifecycle).        |
| What was tested and what is left?               | [Delivery summary](DELIVERY_SUMMARY.md), [requirements matrix](REQUIREMENTS_MATRIX.md), [task evidence](evidence/README.md).              |

## Run, inspect and contribute

Use the [README run instructions](../README.md) for environment files and Docker/host development. Default host-development addresses are web `http://localhost:3000`, API `http://localhost:3001` and worker health `http://localhost:3002`; base Compose keeps the worker port private. Swagger is API `/docs` when enabled; Storybook is `http://localhost:6006` after `pnpm storybook`. The seed users and credentials are documented in the README; never reuse demo credentials for hosted accounts.

Common commands are `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`, `pnpm gen:api`, `pnpm openapi:check`, `pnpm client:check` and `pnpm storybook`. Endpoint changes follow contract → DTO → guarded operation → spec → generated client → behavior test. See the [workflow](DEVELOPMENT_WORKFLOW.md) before changing code.

Docker/local operation is implemented. The new [Render/Neon plan](RENDER.md) supersedes the old hosting target; the existing adapter still uses Vercel/Northflank. Render implementation/activation, first live publication and immutable four-environment promotion have separate open gates. This guide does not claim they are running. There is no billing, file-upload, offline-sync, search or outgoing-webhook product feature today.

For an operational walkthrough, read [delivery operations](DELIVERY_OPERATIONS.md) and [Redis/BullMQ](REDIS_AND_JOBS.md). They explain current behavior separately from deployment plans.
