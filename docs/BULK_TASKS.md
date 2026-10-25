# Atomic bulk task updates

R159 is selected by the instruction to complete the local backlog. This document defines the implementation contract; verification is recorded separately.

## API and scope

`PATCH /v1/tasks` (`bulkUpdateTasks`) updates 1–50 distinct live tasks in the active workspace. The body contains `expectedConfigVersion`, `tasks: [{id, expectedVersion}]`, and one nonempty `patch`. The shared patch supports only `statusId`, `priority`, `assigneeIds`, and `customFields`; title, description, dates, list moves and parent relations remain individual operations.

Task IDs and assignment IDs are normalized UUIDs. Duplicate task IDs are rejected, including differently cased copies. An empty assignment array clears assignments. Custom-field omission preserves values; explicit null clears an optional value. A patch containing only an empty custom-field object is rejected. Unknown properties and client-supplied actor/workspace identity are rejected.

The result is `{data: Task[], configVersion, dataVersion, changedTaskIds}`. `data` follows input order and includes unchanged tasks. `changedTaskIds` contains only tasks actually changed. This is a bounded command response, not a paginated listing.

## Transaction and permissions

The existing authentication and PermissionGuard establish active workspace access. Inside one existing workspace-locked `database.write` transaction, PermissionService authorizes every target for task writes. The service then invokes the existing task update repository for each target, using its supplied task revision and the common configuration revision.

Existing validators remain authoritative for each task's resolved statuses, fields and assignable members. A shared status or field value can be valid in one list and invalid in another; any such failure rejects the entire batch. A stale version, missing/archived/foreign task, denied list, invalid assignment or required-field clearing also rolls back all task changes and outbox entries. Foreign identifiers remain 404; visible-workspace forbidden resources remain 403. Responses never contain a partial success list.

No-op updates reuse existing behavior: they emit no outbox event and advance no revision. Each changed task advances its own version once and the workspace data revision using the existing update operation. The final response reports the resulting workspace revisions; configuration revision remains unchanged. The existing transactional outbox drives realtime invalidation and status activity after commit. A failed batch publishes no event.

## User interface and verification

The UI selects already-loaded rows, caps selection at 50 and submits their displayed versions. It displays one outcome and never silently retries a stale batch. Clearing a field or assignments is explicit. Mixed-list clients use the same API; server validation is not inferred from visible table options.

Required regression cases cover the size/uniqueness/patch contract, successful updates, all-no-op batches, mixed-list status and field differences, forbidden/foreign/archived targets, stale configuration/task versions, assignment access, simultaneous competing batches, and rollback of persisted tasks/outbox. REST tests use the real PostgreSQL harness. Tests in this change are authored for subsequent verification; this document makes no passing-test claim.
