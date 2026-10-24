# Naming and source conventions

These conventions describe the implemented repository. Automated rules are distinguished from review conventions so an agent does not invent enforcement or rename public contracts for appearance.

| Item                                     | Pattern and example                                                                            | Enforcement                                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type aliases, interfaces, classes, enums | PascalCase: `QueryScope`, `CreateTaskDto`, `StatusCategory`                                    | Type-like names are lint checked                                                                                                                  |
| React component declarations             | PascalCase: `TaskForm`                                                                         | Review convention; JSX references are lint checked                                                                                                |
| JSX component references                 | PascalCase: `<TaskForm />`                                                                     | React ESLint rule                                                                                                                                 |
| Functions, methods, local values         | Descriptive camelCase: `createDatabase`, `readTaskWriteResponse`                               | Review convention; `prefer-const`/`no-var` are lint checked                                                                                       |
| Hooks                                    | `use` prefix: `useTaskWrite`, `useZodForm`                                                     | Hook naming is a convention; Rules of Hooks checks apply where the configured React/Next preset enables them, not universally to every `.ts` file |
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
