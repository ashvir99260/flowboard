# Naming and source conventions

These conventions describe the current repository and the required patterns for new files. Retained naming exceptions are identified explicitly. Automated rules are distinguished from review conventions so an agent does not invent enforcement or rename public contracts for appearance.

| Item                                     | Pattern and example                                                                            | Enforcement                                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type aliases, interfaces, classes, enums | PascalCase: `QueryScope`, `CreateTaskDto`, `StatusCategory`                                    | Type-like names are lint checked                                                                                                                  |
| React component declarations             | PascalCase: `TaskForm`                                                                         | Review convention; JSX references are lint checked                                                                                                |
| JSX component references                 | PascalCase: `<TaskForm />`                                                                     | React ESLint rule                                                                                                                                 |
| Functions, methods, local values         | Descriptive camelCase: `createDatabase`, `readTaskWriteResponse`                               | Review convention; `prefer-const`/`no-var` are lint checked                                                                                       |
| Hooks                                    | `use` prefix: `useTaskWrite`, `useZodForm`                                                     | Hook naming is a convention; Rules of Hooks checks apply where the configured React/Next preset enables them, not universally to every `.ts` file |
| Endpoint query hooks                     | `use<Operation>Query` / `use<Operation>InfiniteQuery`: `useGetCurrentUserQuery`                | Naming is reviewed; the web boundary test keeps query setup outside feature view files                                                            |
| Zod contracts                            | PascalCase with `Schema`: `CreateTaskSchema`, `TaskMutationEnvelopeSchema`                     | Review convention                                                                                                                                 |
| DTO adapters                             | PascalCase with `Dto`: `CreateTaskDto`, grouped in `tasks.request.dto.ts`                      | Review convention and typed schema/compiler validation                                                                                            |
| Constants                                | Existing semantic style: `SocketEvents`, `EventJobName`; local constants remain camelCase      | Review convention; no blanket UPPER_SNAKE or PascalCase rewrite                                                                                   |
| Source files and folders                 | Kebab-case with role suffixes: `task-form.tsx`, `use-task-write.ts`, `tasks.service.ts`        | Review convention, not a filename lint rule                                                                                                       |
| UI package files                         | camelCase: `taskTable.tsx`, `useRemSize.ts`; presentation under `src/modules/<area>`           | UI source-layout test; other packages keep their existing filename convention                                                                     |
| Backend tests                            | `*.unit.spec.mjs`, `*.integration.spec.mjs`; bootstrap `*.test.mjs`                            | Runner discovery is executable; purpose naming is a convention                                                                                    |
| Shared/web tests                         | Node/Jest `*.test.mjs`; browser acceptance `e2e/*.spec.ts`                                     | Package runner configuration                                                                                                                      |
| API/DB/wire fields                       | Preserve contract spelling: `workspaceId`, `expectedVersion`, `not_started`                    | Schemas, migrations and compatibility tests                                                                                                       |
| Conventional files                       | Keep reserved names such as `AGENTS.md`, `README.md`, `page.tsx`, `layout.tsx`, `package.json` | Tool/framework conventions                                                                                                                        |

Do not infer that all names must be PascalCase. Do not change enum values, status keys, JSON fields, SQL mappings or operation IDs as a cosmetic rename.

The UI package's camelCase filenames supersede its earlier kebab-case convention (D146). Keep test/story suffixes (`sourceLayout.test.mjs`, `fields.stories.tsx`) and reserved tooling filenames. Split distinct component implementations; a cohesive compound component may keep its private styled parts. Public exports remain available from `@flowboard/ui`, regardless of internal file placement.

## Exact file patterns

Use the full suffix, including the language extension. Write `spec` in the singular and spell `integration` and `unit` exactly as shown.

| Purpose                              | Pattern                                  | Example                                                      |
| ------------------------------------ | ---------------------------------------- | ------------------------------------------------------------ |
| API module/controller/service        | `<feature>.<role>.ts`                    | `tasks.module.ts`, `tasks.controller.ts`, `tasks.service.ts` |
| Request/path/query DTO group         | `<feature>.request.dto.ts`               | `tasks.request.dto.ts`                                       |
| Response DTO group                   | `<feature>.response.dto.ts`              | `tasks.response.dto.ts`                                      |
| Focused shared DTO                   | `<purpose>.dto.ts`                       | `error-response.dto.ts`                                      |
| API unit test                        | `<subject>.unit.spec.mjs`                | `permissions.unit.spec.mjs`                                  |
| API integration test                 | `<subject>.integration.spec.mjs`         | `tasks.integration.spec.mjs`                                 |
| API process/bootstrap test           | `<subject>.test.mjs` in `test/bootstrap` | `startup.test.mjs`                                           |
| Shared UI component                  | `<camelCase>.tsx`                        | `taskTable.tsx` exports `TaskTable`                          |
| UI helper or generic hook            | `<camelCase>.ts`                         | `useRemSize.ts` exports `useRemSize`                         |
| Shared UI rendering/interaction test | `<camelCase>.test.mjs` in `test`         | `domainViews.test.mjs`                                       |
| Shared UI Storybook story            | `<camelCase>.stories.tsx` in `stories`   | `fields.stories.tsx`                                         |
| Web feature component or query hook  | Kebab-case `.tsx` / `.ts`                | `task-form.tsx`, `use-get-current-user-query.ts`             |
| Browser acceptance test              | `<subject>.spec.ts` in web `e2e`         | `task-edit.spec.ts`                                          |

Keep test formats aligned with their runners: API Jest executes `.mjs` against built ESM, UI/web Node tests use `.test.mjs`, and Playwright uses `.spec.ts`. Do not rename one category to another without changing and verifying discovery. The API still has six shared legacy suites with plain `.spec.mjs` names; their exact location and retained status are documented in [backend test rules](BACKEND_GUIDELINES.md#test-file-rules). These suffixes are authoring/review rules, not a claim that a filename linter enforces every pattern.

For placement and creation steps, use [API modules](BACKEND_GUIDELINES.md#creating-an-api-feature) and [UI components](UI_COMPONENT_SYSTEM.md#creating-a-shared-component). API/UI `modules` group different responsibilities; data-aware web adapters continue to live in `src/features`.

## Imports and modules

All authored packages/apps use native ESM and declared public exports. API TypeScript source imports use `.ts`, for example `./task-events.ts`; its compiler rewrites relative paths to `.js` in emitted ESM. Other NodeNext workspaces currently use output extensions such as `.js`; web uses its Next/Bundler resolution conventions. Imports of compiled output in `.mjs` tests and package runtime exports keep `.js`. Use `import type` for type-only dependencies under the shared `verbatimModuleSyntax` compiler setting. There is no dedicated consistent-type-imports or import-extension lint rule to claim here.

Import grouping/order and unused imports are lint checked. Keep explicit side-effect imports intact. Use package exports such as `@flowboard/contracts`, never another package's source paths. Apps do not import each other; packages do not import apps, except the documented OpenAPI build-only spec entry point. See [package rules](../packages/AGENTS.md).

## Readability and ordering

Use `const` until reassignment is necessary. A small dispatch object is useful for a closed value mapping; sequential guards remain appropriate for validation, authorization and transactions. Do not replace readable branches with an abstraction solely to avoid `if`/`switch`.

Follow [CODE_STYLE.md](CODE_STYLE.md) for export/module spacing, blank lines after complete conditional chains and around returns. Decorators remain attached to declarations and return expressions remain attached to `return`.

[CODE_QUALITY.md](CODE_QUALITY.md) owns the exact sorting policy. Preserve positional parameters, evaluation order, class/decorator order and arrays. Runtime-object sorting is conservative and disabled in TSX; do not reorder CSS shorthand/longhand declarations. Every `package.json` keeps its existing key order, including dependency and export maps. Dependencies use exact compatible versions; local packages use `workspace:*`.

## Concrete examples

- [Task DTO group](../apps/api/src/modules/tasks/tasks.request.dto.ts): thin schema adapters grouped by feature and request role.
- [Task service](../apps/api/src/modules/tasks/tasks.service.ts): feature orchestration.
- [Task form data](../apps/web/src/features/tasks/task-form-data.ts): pure draft/default/request mapping.
- [Task write hook](../apps/web/src/features/tasks/use-task-write.ts): generated mutations and validated outcomes.
- [Tenant database](../packages/database/src/tenant-database.ts): scoped transaction boundary.
- [Notification store](../apps/web/src/features/notifications/notification-store.ts): bounded UI state and captured action results.

Match nearby code where these conventions allow choice. A deliberate new convention belongs in a decision and the owning guide, with executable fixtures when lint/behavior changes.
