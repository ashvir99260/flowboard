# Agent guide map

Use this map after the [root instructions](../../AGENTS.md). Read the guide for the area being changed, then the current implementation and tests. New direct user instructions take precedence; historical articles and generated code graphs are reference material.

For application context before coding, read the [application guide](../APPLICATION_GUIDE.md), [HLD](../HLD.md), [LLD](../LLD.md) and [delivery summary](../DELIVERY_SUMMARY.md). Their source snapshots and recorded evidence do not replace verification of a new change.

## Find the right guidance

| Work                         | Start with                                                                                                           | Detailed reference                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Any task                     | [Workflow](../DEVELOPMENT_WORKFLOW.md), [tasks](../TASKS.md), [quality gates](../QUALITY_GATES.md)                   | [Requirements matrix](../REQUIREMENTS_MATRIX.md), [decisions](../DECISIONS.md), task evidence                                    |
| Naming, imports, readability | [Naming conventions](../NAMING_CONVENTIONS.md)                                                                       | [Code style](../CODE_STYLE.md), [enforced quality rules](../CODE_QUALITY.md)                                                     |
| Nest/Express endpoints       | [API instructions](../../apps/api/AGENTS.md)                                                                         | [Backend guide](../BACKEND_GUIDELINES.md), [DTO and entity contracts](../BACKEND_CONTRACTS.md), [API catalog](../API_CATALOG.md) |
| Web routes and features      | [Web instructions](../../apps/web/AGENTS.md)                                                                         | [Frontend guide](../FRONTEND_GUIDELINES.md)                                                                                      |
| Shared presentation          | [UI instructions](../../packages/ui/AGENTS.md)                                                                       | [Component system](../UI_COMPONENT_SYSTEM.md), [style tokens](../STYLE_TOKENS.md)                                                |
| Forms and JSON fields        | [Forms instructions](../../packages/forms/AGENTS.md)                                                                 | [Form system](../FORM_SYSTEM.md)                                                                                                 |
| Shared domain contracts      | [Contracts instructions](../../packages/contracts/AGENTS.md)                                                         | [Field reference](../FIELD_REFERENCE.md), [database model](../DATABASE_DESIGN.md)                                                |
| Prisma, transactions, seed   | [Database instructions](../../packages/database/AGENTS.md)                                                           | [Database README](../../packages/database/README.md), [database model](../DATABASE_DESIGN.md)                                    |
| Spec and generated SDK       | [OpenAPI instructions](../../packages/openapi/AGENTS.md), [client instructions](../../packages/api-client/AGENTS.md) | [API catalog](../API_CATALOG.md), [shared contracts](../BACKEND_CONTRACTS.md)                                                    |
| Jobs, activity and sockets   | [Worker instructions](../../apps/worker/AGENTS.md), API instructions                                                 | [Events](../api-events.md), [logging](../LOGGING.md)                                                                             |
| Build, CI and deployment     | [Package rules](../../packages/AGENTS.md)                                                                            | [Delivery](../DELIVERY.md), [promotion](../PROMOTION.md), [quality gates](../QUALITY_GATES.md)                                   |
| Code navigation and tooling  | [AI tools](../AI_TOOLS.md)                                                                                           | [Graphify](../GRAPHIFY.md), [explicit artifact inspection](../REA.md)                                                            |

## Authority and maintenance

For component examples and interactive checks, follow the [Storybook guide](../STORYBOOK.md).

Schemas define contracts; executed passing tests provide evidence of runtime behavior. Test files alone do not prove behavior. Lint/compiler configuration determines automated enforcement. Guides explain ownership and conventions; they do not prove an implementation passes. Check [task evidence](../evidence/README.md) before making completion claims.

Keep each rule in one detailed guide. Scoped AGENTS files provide the short boundary and links. When changing a code pattern, update its owning guide and concrete example links in the same task. Label future work and historical research explicitly instead of letting it read like current implementation.

Graphify and Serena can narrow a search, but verify results against source. Keep graphs, audit output and temporary reports in ignored local directories. Use only the relevant installed skills; a missing optional tool does not block ordinary source inspection. Do not change global settings, install global hooks or upload repository data as part of routine coding.

## Before handing off

Confirm the affected requirement/task IDs, real checks and limitations. Preserve unrelated changes. Commit one completed task with a conventional message; a stacked PR targets the preceding unmerged branch. Publication, merging and deployment need the user's applicable authorization. See the workflow for the full protocol rather than copying it into each scope file.
