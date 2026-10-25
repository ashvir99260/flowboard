# MVP alignment implementation plan

> For agentic workers: execute the selected P28 tasks sequentially using the repository's executing-plans workflow. Each task owns a failing behavior check, implementation, applicable gates, evidence and a commit. Read the current task and source before starting.

**Goal:** Expand the main demo workspace, close confirmed MVP gaps and keep optional ideas explicit.

**Architecture:** Preserve the modular NestJS/Next.js system, tenant repositories and generated contracts. A board is a list view. The fixture expansion uses the existing opt-in, seed-once transaction; it never overwrites an initialized database. Optional enhancements require their own design selection before implementation.

**Tech stack:** Existing TypeScript/ESM, Prisma/PostgreSQL, Nest/Express, Next/MUI, Zod, generated Hey API/TanStack, Redis/BullMQ and existing test runners.

**Spec:** [Follow-up requirements](REQUIREMENTS.md#follow-up-requirements--richer-demo-and-mvp-alignment-25-october-2026), [D154](DECISIONS.md#d154--ordered-mvp-alignment-and-safe-richer-demo), [task entries](TASKS.md#phase-28--richer-demo-and-mvp-alignment).

## Global constraints

Keep real login and the second tenant. Use public package exports and exact dependency versions; no new framework or duplicate board entity. Preserve existing IDs, assignments, status identities and field keys. Existing databases remain unchanged by seed retries. No destructive volume reset, cloud deployment or automatic optional-feature implementation is authorized by this plan.

## Review focus

- Existing v1 demo data, edits, passwords, grants and audit times must survive subsequent initialization.
- New member assignments must obey private ancestors and explicit denies; frontend hiding alone is insufficient.
- Every generated task must validate against its own list's resolved statuses and complete field schema.
- Optional color omission and datetime changes must update real contracts, generated artifacts, persistence and callers together.
- Row activation must preserve keyboard access and avoid opening a task when an embedded control performs another action.

## Selected sequence and interfaces

| Task   | Result and owned files                                                                                                                                                         | Public seam / failure-first check                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P28-01 | This plan, requirements/matrix/decisions/tasks/summary and evidence.                                                                                                           | Document links, coverage and separation of planned/considered/implemented behavior.                                                                                                                                           |
| P28-02 | `packages/database/src/seed.ts` plus a focused seed module if needed; database seed tests, API permission/task-invariant tests, Compose count assertion and current seed docs. | `initializeDatabase({databaseUrl, demoSeed})`: fresh main workspace has 3 spaces/4 folders/6 lists/48 tasks/5 members, valid resolved data and distinct visible trees. Existing markers yield `{seeded:false}` without edits. |
| P28-03 | `packages/contracts/src/custom-fields.ts`, field forms/display, API generated artifacts and tests.                                                                             | Option without `color` is accepted; malformed supplied color is rejected; neutral rendering and editing roundtrip preserve omission.                                                                                          |
| P28-04 | `packages/ui/src/modules/tasks/taskTable.tsx` and table/browser stories/tests.                                                                                                 | Non-interactive row content opens exactly once; embedded controls do not bubble a second action; title remains keyboard usable.                                                                                               |
| P28-05 | README, focused AI usage log and source/history citations.                                                                                                                     | Each claimed correction has evidence; planned roadmap is separated from completed work.                                                                                                                                       |
| P28-06 | Task/date schemas, checked-in migration, task repositories/cursors, forms/display, OpenAPI/client and tests.                                                                   | ISO instant roundtrips across timezones; old calendar dates migrate to UTC midnight; nulls/ties/sorting and date custom fields retain their intended behavior.                                                                |

Detailed acceptance, dependencies and commit messages live once in [TASKS.md](TASKS.md). For every selected implementation task:

- [ ] Read its scoped instructions and inspect consumers.
- [ ] Add the named behavioral assertion and observe the expected failure.
- [ ] Implement the smallest compatible change.
- [ ] Pass focused tests and required root gates; inspect the diff.
- [ ] Record exact results, mark only proven scope complete, and commit that task.

## First implementation: richer fresh-demo fixtures

Retain the original Engineering and Design spaces, their three lists and 24 tasks. Add a private Operations space with two folders and three lists: Support triage, Incident follow-up and Routine operations. Add Eve and Frank as members. Both can enter Operations; Frank is denied the support folder; Eve can enter its private triage list. Alice remains administrator; Bob/Carol's original visible trees and grants stay unchanged. Dan and Other Tenant remain isolated.

Keep the original four fields. Add text and multi-select fields in Operations, a required single-select for support work, and a checkbox for routine work. Every list resolves at least two fields; new task fixtures include false, zero, absent optional values, multiple selections and varied dates/priorities. Introduce a scoped waiting status without altering the original lists. Add eight realistic tasks per new list, making 48 main-workspace tasks.

Existing `demo-v1` markers continue to prevent all writes. Fresh databases get the expanded fixture atomically. Document a separate Compose project and unused host ports to inspect fresh data; do not delete or modify an existing volume. A later additive upgrade is a separate design because user-edited field schemas, access and IDs may conflict with new fixtures.

## Considered enhancements

| Task    | Consideration; not implementation approval                                                                                 |
| ------- | -------------------------------------------------------------------------------------------------------------------------- |
| NEXT-02 | Workspace rename/archive: decide membership/session recovery, retained history and restoration first.                      |
| NEXT-03 | One-level subtasks: parent/list ownership, no cycles/depth >1, parent archival and cross-list moves.                       |
| NEXT-01 | Full-text search: PostgreSQL-first search design, permission scoping, indexing/reindexing and replacing the explicit stub. |
| NEXT-04 | Bulk updates: bounded batches, per-task revisions, mixed-list validation and all-or-nothing failure policy.                |
| NEXT-05 | Container/grant management UI: compose existing generated APIs with safe confirmations and stale-draft handling.           |

The previous brief already required filtering, optimistic updates, activity, realtime and generated API contracts. Keep those working features; explain the scope difference instead of removing them to meet a later two-stretch suggestion. Hosting and four-environment promotion keep their existing separate gates.
