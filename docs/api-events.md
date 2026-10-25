# Task events and shared contracts

Flowboard currently delivers activity and browser invalidations. It does not provide outbound webhook subscriptions, signing secrets, delivery attempts or an HTTP sender. The task-updated examples below are a possible future webhook payload and the current internal `TaskUpdatedEventSchema` payload. A future webhook feature must separately define consent, authentication/signatures, retries, destination validation and payload visibility.

## Task status update

The persisted outbox envelope identifies this event as `task.updated`. Its `payload` is the following object; `eventType` is not an extra field inside this strict payload schema.

```json
{
  "schemaVersion": 1,
  "eventId": "f1000000-0000-4000-8000-000000000950",
  "workspaceId": "f1000000-0000-4000-8000-000000000001",
  "actorId": "f1000000-0000-4000-8000-000000000101",
  "occurredAt": "2026-10-24T12:00:00.000Z",
  "taskId": "f1000000-0000-4000-8000-000000000700",
  "taskVersion": 2,
  "previousListId": "f1000000-0000-4000-8000-000000000221",
  "currentListId": "f1000000-0000-4000-8000-000000000221",
  "changes": {
    "statusId": {
      "before": "f1000000-0000-4000-8000-000000000400",
      "after": "f1000000-0000-4000-8000-000000000401"
    }
  }
}
```

## Cross-list update

List movement must agree with both endpoint IDs and `changes.primaryListId`. A title/description change is represented by `true`, not its content. Custom-field changes name keys without carrying values. This reduces accidental content exposure; the internal event still contains private identities and must not be published wholesale to browsers.

```json
{
  "schemaVersion": 1,
  "eventId": "f1000000-0000-4000-8000-000000000951",
  "workspaceId": "f1000000-0000-4000-8000-000000000001",
  "actorId": "f1000000-0000-4000-8000-000000000101",
  "occurredAt": "2026-10-24T12:01:00.000Z",
  "taskId": "f1000000-0000-4000-8000-000000000700",
  "taskVersion": 3,
  "previousListId": "f1000000-0000-4000-8000-000000000221",
  "currentListId": "f1000000-0000-4000-8000-000000000223",
  "changes": {
    "primaryListId": {
      "before": "f1000000-0000-4000-8000-000000000221",
      "after": "f1000000-0000-4000-8000-000000000223"
    },
    "title": true,
    "customFieldKeys": ["team"]
  }
}
```

## Delivery and browser visibility

The API commits the domain mutation and outbox record in one PostgreSQL transaction. The worker-owned dispatcher leases and enqueues a stable reference to that committed record. BullMQ workers verify the stored event and lease identity, write status-change activity idempotently by event ID, publish on private Redis, then complete delivery. A crash can cause repeated delivery; consumers must tolerate duplicates. Queue acceptance and activity insertion do not by themselves mean a browser received an event.

The Nest Socket.IO gateway uses the Redis adapter to fan out signals between API instances. JWT signature, session, membership, Origin and current list access are checked at connection/subscription/delivery boundaries. Public `invalidate` messages follow `RealtimeInvalidationSchema`, with only these shapes:

```json
{
  "kind": "list",
  "listId": "f1000000-0000-4000-8000-000000000221",
  "eventId": "f1000000-0000-4000-8000-000000000950"
}
```

A workspace invalidation contains `kind: "workspace"` and `eventId`; a generic resync signal contains only `kind: "resync"`. The browser subscribes with `list.subscribe` and `{listId}`, then refetches using generated REST operations. It does not send an acting tenant, role or user. A viewer of only the source list receives no destination ID or task content. Access changes, JWT expiry and sign-out close invalid subscriptions/connections. Clients deduplicate signals and refetch on reconnect because Redis Pub/Sub has no durable replay guarantee.

Clients may opt into notification metadata with the public Socket.IO handshake query `notifications=v1`. The authentication payload still contains only `token`, so this connection works with older servers. For opted-in clients, list/workspace invalidations additionally carry `self: boolean`, computed from the authenticated recipient and committed event actor. Legacy clients receive the unchanged shapes above. No actor ID, task content or private destination is exposed.

The web app shows a content-free Toastify notification only for `self: false` events affecting its current subscriptions, deduplicating the event ID across move endpoints. Same-account changes in other tabs still refresh data without an extra remote toast. Resync and connection refresh stay quiet. The notification queue is transient; the task activity feed is the durable history.

## What is shared

| Contract                                          | Owners and use                                                                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| REST requests, responses, cursor pages and errors | Zod in `packages/contracts`, Nest DTO/Swagger, committed OpenAPI, generated Hey API SDK/options, web and curl.                                        |
| Status/field resolution and value validation      | Pure functions in contracts, called by API services and web configuration previews. The server remains authoritative.                                 |
| Task and workspace events                         | Versioned contracts, transactional outbox, dispatcher and worker. These are private infrastructure data.                                              |
| Public socket names and invalidation shapes       | Contracts, API gateway and browser invalidation coordinator. No parallel mutation protocol.                                                           |
| Presentation and interaction                      | MUI components, route state, drawers, keyboard/focus and optimistic previews belong to web/UI. They do not grant access or replace server validation. |

Schema changes require contract tests, OpenAPI/client regeneration when REST changes, and explicit compatibility decisions for stored events. Existing event IDs are stable across retries. See the [curl walkthrough](../scripts/curl-cookbook.md), [architecture](../ARCHITECTURE.md) and [API catalog](API_CATALOG.md).
