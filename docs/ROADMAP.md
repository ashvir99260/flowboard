# Delivery priorities

This is a priority guide, not a promise of elapsed delivery time. [TASKS.md](TASKS.md) owns task order and acceptance; the [requirements matrix](REQUIREMENTS_MATRIX.md) and task evidence own completion status. Later direct instructions take precedence over historical plans.

## Delivered baseline

The local application includes authenticated workspaces, a permission-filtered hierarchy, scoped status and field resolution, task editing/moves, board and table views, generated API clients, realtime updates and a durable activity worker. [P28-02](evidence/P28-02.md) adds a fresh-install demo with five main-workspace members, three spaces, six lists, 48 tasks and varied access/field configuration. Existing installations are not silently reseeded. [P28-03](evidence/P28-03.md) makes option colors optional; [P28-04](evidence/P28-04.md) adds safe table-row opening.

Typed custom-field filtering, optimistic rollback, activity/realtime and Swagger/client generation are already delivered. The earlier project brief explicitly required these features. A later comparison brief suggested at most two stretch features; that retrospective limit does not remove functionality already requested and implemented.

## Day-5 priorities

1. **Finish datetime alignment — P28-06 / R155.** Preserve task due times end to end, migrate existing calendar dates to midnight UTC, keep custom date fields as calendar dates, and test cursor/timezone behavior and pending events.
2. **Workspace lifecycle — NEXT-02 / R156.** Design and implement administrator rename/archive/recovery with safe session behavior, retained history and tenant isolation.

The day label expresses the next useful increment after the existing MVP. Each implementation still requires its own tests, evidence and commit.

## Week-2 priorities

1. **One-level subtasks — NEXT-03 / R157.** Define parent/list ownership, depth and archive/move rules before adding persistence and UI.
2. **Search — NEXT-01 / R158.** Replace the declared stub with permission-filtered title/description search and tested update/archive behavior.
3. **Bounded bulk updates — NEXT-04 / R159.** Use per-task versions and atomic validation; rejected batches must leave no partial writes or events.
4. **Container and grant screens — NEXT-05 / R160.** Compose existing guarded APIs into accessible management forms with stale-draft handling and clear visibility rules.

D155 records the user's selection of these local enhancements for implementation. They are selected work, not implemented features merely because this roadmap exists. Split large items into safe vertical tasks before coding.

## External delivery gates

Provider setup and live verification remain distinct from local product completion: first release publication, Render/Neon preview activation, and four-environment build-once promotion require their owning tasks and configured infrastructure. See [delivery operations](DELIVERY_OPERATIONS.md), [Render](RENDER.md), [CI/CD](CI_CD.md) and [promotion](PROMOTION.md). A plan or successful local build is not proof of a deployed environment.

## Consider later

OIDC integration, team-based grants, attachment storage, billing, outbound webhook delivery and general container/task restoration remain future choices. Workspace recovery is selected above; it does not imply restoration exists for every archived resource. Keep the modular API and worker until measured workload or ownership justifies service splits. Revisit indexing, tenant-lock contention and large-tree queries with actual measurements.
