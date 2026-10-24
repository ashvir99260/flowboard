# Flowboard REST API implementation catalog

Status: **43 REST operations implemented with typed contracts and generated OpenAPI**. Reviewed 24 October 2026. Shared Zod schemas and the committed [OpenAPI document](../packages/openapi/openapi.json) are executable sources; this catalog explains their policy and usage. See task evidence for verification.

[Workspace RBAC and DTO/entity design](BACKEND_CONTRACTS.md) specifies workspace field inheritance, audit timestamps and decorator-driven Swagger → generated Next.js contracts.

## Contract conventions

All domain paths below start with `/v1`. Browser SDK requests use the same paths through web-origin `/api/v1`; curl calls API `/v1` directly. Health paths are operational exceptions. JSON uses camelCase, UUID identifiers and strict objects: reject unknown input properties, including forged workspaceId/userId/role except explicitly defined target fields. Server-owned IDs, task/node positions, timestamps and acting identity cannot be assigned in bodies.

Every full persisted-resource response includes createdAt and updatedAt; computed views include source timestamps instead. Requests reject client-supplied audit values. Entities stay internal, DTOs are built from shared schemas, and named response DTOs drive Swagger serialization/generation as specified in BACKEND_CONTRACTS.

Every operation needs its listed unique lowerCamelCase operationId. Resource names do not encode UI layout: board and table both read `listTasks`. Framework-free schemas live in `packages/contracts`; Nest uses `nestjs-zod` DTOs, global request validation and response serialization. No `any` response or untyped JSON catch-all except the explicitly typed custom-field value union.

Responses use `{data: T}` for entities and `{items: T[], pageInfo: {nextCursor: string|null, hasNextPage: boolean}}` for paginated collections. Scoped complete collections use `{items: T[], configVersion: number}`. Task/tree responses add `configVersion` and `dataVersion`; 200/201 task mutation responses also contain `changedTaskIds: UUID[]` for refetching renumbered siblings. `204` has no JSON body. The two health success responses intentionally use their documented bare status shape. Error responses always use the shared error envelope below. Datetimes are UTC ISO strings; dates are strict `YYYY-MM-DD` without timezone conversion.

No public delete physically removes nodes/tasks. DELETE archives a live target; a repeat request to an archived/missing target returns 404. Config DELETE removes a local override/definition only after validating its resulting effective state. Bodies on DELETE carry required version guards; the proxy/SDK must preserve them. No bulk deletion, restore, search or external webhook delivery endpoint is implied.

## Identity, access and errors

| Policy  | Meaning                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public  | No JWT; rate/size bounded. Cookie-producing auth requests still enforce browser Origin.                                                           |
| Session | Verify access JWT signature/expiry and live refresh family; permits workspace switching even if membership in the previous workspace was removed. |
| Member  | Session plus current DB membership in JWT-selected workspace. Never trust JWT role as current authority.                                          |
| Visible | Member plus PermissionGuard/PermissionService on every relevant resource/ancestor. Members may edit visible tasks.                                |
| Admin   | Member with current DB admin role; bypass visibility inside this workspace only.                                                                  |
| Cookie  | Opaque refresh cookie, live family, Origin and rotation checks; no valid access JWT required.                                                     |

Paths carrying workspaceId must match the JWT-selected workspace except `listWorkspaces` and the explicit `switchWorkspace` target. The latter checks target membership. `/me` and workspace listing let a session recover after removal from the old workspace. Scope configuration is admin-only, including raw inherited rows; ordinary members consume resolved schemas for visible lists.

Cookie-producing/consuming routes require an allowlisted Origin (login, signup, refresh, logout and switch). Curl supplies the documented Origin too. Use host-only httpOnly cookie, Path=/, SameSite=Lax, Secure on HTTPS, and no credentials in URLs/logs. Access tokens last 15 minutes; refresh families have a fixed seven-day lifetime. Refresh/switch rotate credentials atomically; used-token replay revokes the family. Browser access tokens stay in memory. JWT validation reads the unique current family credential and compares its activeWorkspaceId; consuming an older credential during ordinary refresh alone does not invalidate a still-valid JWT. A family has one active workspace; switching invalidates old-workspace access tokens and clears tenant caches/subscriptions. A login with no memberships returns activeWorkspace=null and a session-only JWT, allowing invitation acceptance but no domain access. If refresh finds that the selected membership was removed it returns403 MEMBERSHIP_REQUIRED; a reloaded client reauthenticates, then selects an available workspace. It must not loop on refresh. Coordinate switch and refresh with one tab lock and session generation: abort old requests and never retry an old-workspace command after a switch. See D63/D66.

Error examples and codes are part of the contract; implementation must add them to the shared enum before use:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Task values are invalid.",
    "details": [
      { "path": ["customFields", "effort"], "code": "required", "message": "Effort is required." }
    ]
  }
}
```

| HTTP      | Codes / behavior                                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400       | VALIDATION_FAILED, STATUS_NOT_AVAILABLE, FIELD_VALUE_INVALID, INVALID_PARENT, INVALID_ANCHOR, INVALID_CURSOR. Include field paths for invalid request values.                                                                                     |
| 401       | UNAUTHENTICATED, SESSION_EXPIRED, REFRESH_REUSED. Do not reveal whether an email exists on a failed login.                                                                                                                                        |
| 403       | FORBIDDEN, MEMBERSHIP_REQUIRED, ORIGIN_REJECTED. Same-tenant inaccessible resources give 403; filtered tree silently omits them.                                                                                                                  |
| 404       | NOT_FOUND for missing, archived or foreign-tenant path IDs and relation targets. Never probe globally to distinguish missing from foreign.                                                                                                        |
| 409       | VERSION_CONFLICT, CONFIG_CONFLICT, CURSOR_STALE, STATUS_IN_USE, FIELD_IN_USE, CONFIG_INVALIDATES_TASKS, LAST_ADMIN, EMAIL_IN_USE, INVITATION_UNAVAILABLE. Invalidated category requirements/config use conflict with sanitized scope/field paths. |
| 413 / 429 | PAYLOAD_TOO_LARGE / RATE_LIMITED. Bounded request size and auth throttling; 429 supplies Retry-After.                                                                                                                                             |
| 500 / 503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE. Sanitized message plus request ID header; no SQL, cookies, tokens or stack.                                                                                                                                 |

Validation order: parse/authenticate, scope resource existence in the active tenant, authorize, lock/re-read, check versions, validate full domain result, write/outbox, serialize. Relation IDs such as destination/anchor/assignee use 404 when absent/foreign and 403 when known in-tenant but inaccessible. **Task statusId is a special closed-set value:** validate only against the accessible destination list's resolved statuses and return 400 STATUS_NOT_AVAILABLE for any unknown/unavailable value, including a foreign UUID. This meets unknown-status validation without disclosing a foreign record. Scope status/field path IDs still use scoped 404. Error details never include inaccessible task titles or container names.

## Input and output shapes

Every stored and embedded field has an explicit type, relationship and validation rule in [FIELD_REFERENCE](FIELD_REFERENCE.md). All lengths are explicit planned bounds. Strings are trimmed only where stated; descriptions preserve Markdown whitespace. IDs must be UUIDs. Names are trimmed, 1–120 characters; normalized emails max 254; passwords 12–128 characters without silent trimming; keys match `[a-z][a-z0-9_]{0,63}`; colors are six-digit hex. A task title is trimmed/nonempty, max500; description max50,000. At most20 assignees,100 custom-field keys,100 options per field,2,000 characters per text value and 20,000 total task-value JSON bytes. These are hobby-scale limits, not measured capacity claims.

| Schema name               | Fields / meaning                                                                                                                                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UserSummary               | id, name, email, createdAt, updatedAt. Email appears only in self/admin membership views, never task assignee cards.                                                                                                                                                    |
| SessionResult             | accessToken, expiresAt, user: UserSummary, activeWorkspace: WorkspaceSummary nullable. Refresh is cookie-only.                                                                                                                                                          |
| CurrentUser               | user, activeWorkspace nullable (also null when current membership is gone); use listWorkspaces for the paginated membership list. No password/session digest.                                                                                                           |
| WorkspaceSummary / Member | id, name, createdAt, updatedAt / userId, name, email (admin/self only), role, createdAt, updatedAt. Member listing for ordinary members returns id/name/role/createdAt/updatedAt without email.                                                                         |
| Node                      | id, workspaceId, name, type, parentId nullable, position, visibility, version, archivedAt nullable, timestamps. Virtual workspace tree root has type workspace; it is not stored as Node.                                                                               |
| ScopeStatus               | {identity, override}: identity has id (stable statusId), workspaceId, key, category and timestamps; override has its distinct id, workspaceId, statusId, ownerType/ownerId, nullable name/color/position/hidden and timestamps. Only identity.id becomes task.statusId. |
| ResolvedStatus            | id (stable statusId), key, category, effective name/color/position, origin scope, attribute source scopes with source timestamps, inherited/local/overridden indicators. Hidden definitions are excluded from task choices.                                             |
| FieldDefinition           | id, key, name, type, required, options: {id,label,color}[], ownerType, ownerId, position. key/owner immutable; options have stable UUID IDs; createdAt/updatedAt are server-generated.                                                                                  |
| ResolvedField             | FieldDefinition plus source scope/timestamps and inherited flag. Nearest definition wins as a whole.                                                                                                                                                                    |
| Task                      | id, workspaceId, title, description, statusId, priority, assigneeIds, assignees: {id,name}[], dueDate nullable, customFields, position, primaryListId, version, archivedAt nullable, createdAt, updatedAt.                                                              |
| Activity                  | id, taskId, actor: {id,name}, eventId, type, sanitized typed change payload, createdAt, updatedAt. No raw stored event or identity credentials.                                                                                                                         |
| Grant                     | resourceId, userId, mode: allow\|deny, createdAt, updatedAt. Target user must be a current workspace member.                                                                                                                                                            |

`FieldValue` is text/string, finite number, option UUID, unique option UUID array, date string or boolean according to the resolved type. No string-to-number or truthiness coercion. Required text cannot be blank, required multi-select cannot be empty, while `0` and `false` satisfy required number/checkbox. Missing and explicit null differ: null clears an optional value and is not stored as a value; clearing a required value fails.

## Operation inventory

Version notation: **V** = expectedVersion body; **C** = expectedConfigVersion body. Missing/malformed guards are 400; mismatches are 409. Node changes use both V and C, because hierarchy changes affect inherited config. Task commands use V and C; create uses C. All target checks repeat inside the transaction. Pagination notation **P** means the standard limit/cursor query.

### Auth and workspaces

| Method | Path                                            | operationId               | Access           | Input → success                                                                                                            | Task   |
| ------ | ----------------------------------------------- | ------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| POST   | `/v1/auth/signup`                               | signUp                    | Public + Origin  | name, email, password, workspaceName → 201 SessionResult + cookie; atomically create user/workspace/admin/default statuses | P02-01 |
| POST   | `/v1/auth/login`                                | logIn                     | Public + Origin  | email, password → 200 SessionResult + cookie; deterministic first membership (createdAt/id), or null when none exist       | P02-01 |
| POST   | `/v1/auth/refresh`                              | refreshSession            | Cookie           | empty body → 200 SessionResult + rotated cookie                                                                            | P02-02 |
| POST   | `/v1/auth/logout`                               | logOut                    | Cookie + Origin  | empty body → 204, revoke family and expire cookie; missing/already-revoked cookie is idempotent204                         | P02-02 |
| POST   | `/v1/auth/switch-workspace`                     | switchWorkspace           | Session + Cookie | workspaceId → 200 SessionResult + rotated cookie after target-membership check                                             | P02-03 |
| GET    | `/v1/me`                                        | getCurrentUser            | Session          | none → 200 CurrentUser                                                                                                     | P02-03 |
| GET    | `/v1/workspaces`                                | listWorkspaces            | Session          | P → 200 Page<WorkspaceSummary> for caller's memberships                                                                    | P02-03 |
| GET    | `/v1/workspaces/{workspaceId}/members`          | listWorkspaceMembers      | Member           | P, optional assignableToListId → 200 Page<Member>, configVersion; omit other emails for ordinary members                   | P02-03 |
| POST   | `/v1/workspaces/{workspaceId}/members`          | addWorkspaceMember        | Admin            | existing user's email, target role, C → 201 Member; unknown account404, already member409                                  | P02-03 |
| PATCH  | `/v1/workspaces/{workspaceId}/members/{userId}` | updateWorkspaceMember     | Admin            | target role, C → 200 Member; protect last admin                                                                            | P02-03 |
| DELETE | `/v1/workspaces/{workspaceId}/members/{userId}` | removeWorkspaceMember     | Admin            | C → 204 after grant/assignment cleanup and task events                                                                     | P02-03 |
| POST   | `/v1/workspaces/{workspaceId}/invitations`      | createWorkspaceInvitation | Admin            | email, target role, C → 201 {invitationId, token, expiresAt}; token shown once for manual sharing                          | P02-03 |
| POST   | `/v1/invitations/accept`                        | acceptWorkspaceInvitation | Session          | token → 200 WorkspaceSummary after normalized-email match; no auto-switch                                                  | P02-03 |

`listWorkspaceMembers` accepts optional `assignableToListId` for assignee selection. It authorizes that list and returns only members with access to it; cursor identity includes the filter. This extension shipped with P06-02 and reveals no inaccessible task or destination information.

P02-03 returns a token to share privately and accepts it in the request body; it does not yet provide a browser acceptance link or form. A later UI share link may carry it in a URL fragment that the acceptance form exchanges; never query parameters, analytics or server access logs. Use 48-hour invitation expiry, digest storage and single-use acceptance. The user signs in/signs up before acceptance. A signed-in nonmatching email receives a generic INVITATION_UNAVAILABLE; failed acceptance changes nothing. No email sender is promised. Session/auth bodies may contain credentials in transit but logs must redact them.

### Hierarchy and grants

| Method | Path                                 | operationId     | Access  | Input → success                                                                                                         | Task          |
| ------ | ------------------------------------ | --------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- | ------------- |
| GET    | `/v1/tree`                           | listVisibleTree | Member  | P → 200 Page<Node> with separate root: {id,name,type:"workspace"} metadata and both revisions; parents precede children | P03-02        |
| POST   | `/v1/nodes`                          | createNode      | Admin   | name, type, parentId nullable, visibility, C → 201 Node + revisions; append sibling position                            | P03-01        |
| GET    | `/v1/nodes/{nodeId}`                 | getNode         | Visible | none → 200 Node + configVersion/dataVersion                                                                             | P03-01/P03-02 |
| PATCH  | `/v1/nodes/{nodeId}`                 | updateNode      | Admin   | name and/or visibility, V+C → 200 Node + revisions                                                                      | P03-01        |
| DELETE | `/v1/nodes/{nodeId}`                 | archiveNode     | Admin   | V+C → 204, archive subtree/tasks and persist invalidations atomically                                                   | P03-01        |
| POST   | `/v1/nodes/{nodeId}/move`            | moveNode        | Admin   | parentId, placement, V+C → 200 Node + revisions; full descendant revalidation                                           | P06-05        |
| POST   | `/v1/nodes/{nodeId}/reorder`         | reorderNode     | Admin   | placement, V+C → 200 Node + revisions                                                                                   | P03-03        |
| GET    | `/v1/nodes/{nodeId}/grants`          | listNodeGrants  | Admin   | P → 200 Page<Grant> + configVersion                                                                                     | P03-02        |
| PUT    | `/v1/nodes/{nodeId}/grants`          | upsertNodeGrant | Admin   | userId, mode, C → 200 Grant + configVersion                                                                             | P03-02        |
| DELETE | `/v1/nodes/{nodeId}/grants/{userId}` | removeNodeGrant | Admin   | C → 204                                                                                                                 | P03-02        |

P03-01 exposes the four create/read/update/archive operations to administrators only. Member-visible reads and the tree/grant endpoints arrive in P03-02.

Root spaces have null parentId; folders require space, lists require folder. Virtual workspace ID is never a substitute for null root parent. `placement` is a strict union: `{edge:"start"}`, `{edge:"end"}`, `{beforeId:UUID}` or `{afterId:UUID}`. An anchor must be a live sibling, distinct from target, and rechecked under lock. No raw numeric position or two simultaneous anchors. Reparenting validates statuses/fields of all affected live tasks; it rejects invalid descendants rather than silently changing them.

Permission traversal is ancestor-aware: any deny blocks the subtree; each private ancestor needs an explicit allow. Admins bypass inside the tenant. Tree paging orders depth, ancestor path position/ID, then node ID, so an accessible child never appears before an accessible ancestor. Visibility changes update configVersion and revoke subscriptions.

### Statuses and custom fields

`ownerType` is workspace|space|folder|list for statuses, workspace|space|folder|list for fields. Workspace ownerId must equal active workspace; other owner IDs must be that exact live node type. Responses for local scope collections include configVersion and `ancestorScopes` metadata for authorized preview queries. Workspace field definitions inherit into every list unless replaced by a nearer complete definition. Both workspace status and field owner IDs must equal the active workspace ID. These are bounded complete collections, not cursor pages: at most100 definitions per scope and100 effective definitions for a list; reject additions exceeding these limits.

| Method | Path                                                   | operationId             | Access  | Input → success                                                                       | Task          |
| ------ | ------------------------------------------------------ | ----------------------- | ------- | ------------------------------------------------------------------------------------- | ------------- |
| GET    | `/v1/scopes/{ownerType}/{ownerId}/statuses`            | listScopeStatuses       | Admin   | none → 200 Complete<ScopeStatus> + ancestorScopes                                     | P04-02        |
| POST   | `/v1/scopes/{ownerType}/{ownerId}/statuses`            | createScopeStatus       | Admin   | create/override union below, C → 201 ScopeStatus + configVersion                      | P04-02        |
| PATCH  | `/v1/scopes/{ownerType}/{ownerId}/statuses/{statusId}` | updateScopeStatus       | Admin   | local nullable name/color/position/hidden patch, C → 200 ScopeStatus + configVersion  | P04-02        |
| DELETE | `/v1/scopes/{ownerType}/{ownerId}/statuses/{statusId}` | removeScopeStatus       | Admin   | C → 204 after effective-set/in-use validation                                         | P04-02/P04-03 |
| GET    | `/v1/lists/{listId}/resolved-statuses`                 | getListResolvedStatuses | Visible | none → 200 Complete<ResolvedStatus>                                                   | P04-02        |
| GET    | `/v1/scopes/{ownerType}/{ownerId}/fields`              | listScopeFields         | Admin   | none → 200 Complete<FieldDefinition> + ancestorScopes                                 | P05-02        |
| POST   | `/v1/scopes/{ownerType}/{ownerId}/fields`              | createScopeField        | Admin   | key, name, type, required, options, position, C → 201 FieldDefinition + configVersion | P05-02        |
| PATCH  | `/v1/scopes/{ownerType}/{ownerId}/fields/{fieldId}`    | updateScopeField        | Admin   | mutable definition fields (not key/owner), C → 200 FieldDefinition + configVersion    | P05-02        |
| DELETE | `/v1/scopes/{ownerType}/{ownerId}/fields/{fieldId}`    | removeScopeField        | Admin   | C → 204 after resulting-task validation                                               | P05-02/P05-03 |
| GET    | `/v1/lists/{listId}/resolved-fields`                   | getListResolvedFields   | Visible | none → 200 Complete<ResolvedField>                                                    | P05-02        |

Status creation is `{kind:"define",key,category,name,color,position}` or `{kind:"override",statusId,name?,color?,position?,hidden?}`, plus C. Define reuses a workspace identity with the same key/category; conflicting category409. Override requires an inherited status. Defining a previously unseen local status requires every display value. PATCH changes an existing local row only; 404 if none. Null inherits a display attribute; hidden null inherits, true hides, false restores. At least one mutable property is required. Key/category/owner cannot be patched.

Resolve root→space→folder→list by key, preserving identity/category; apply nearest nonnull display attributes and hidden state, sort position/key/id, then remove hidden definitions. Every effective scope must retain not_started, active and done. Status mutation checks all affected live descendants/tasks under the lock. Delete removes a local row, possibly revealing an ancestor. A referenced status becoming unavailable gives 409 STATUS_IN_USE; losing a required category gives 409 CONFIG_INVALIDATES_TASKS. Physical identity deletion is internal-only and blocked by archived references too.

Fields resolve the same chain including workspace, replacing the entire definition for a colliding key. A local field override is created by POST with that inherited key and a complete new definition. Only select types have options; nonselect options must be empty. Removing/changing fields validates every affected live task; no orphan-value retention or implicit data conversion. A delete revealing a compatible ancestor may succeed. Otherwise used values give FIELD_IN_USE or CONFIG_INVALIDATES_TASKS.

For workspace/space/folder previews, the admin fetches each listed ancestor's local rows plus the selected scope and runs the shared resolver. All responses must have matching configVersion; bounded retry on mismatch. There is no need for a speculative extra preview endpoint. Member list UI always uses authoritative list-resolved responses.

### Tasks and activity

| Method | Path                          | operationId      | Access                            | Input → success                                                                                                          | Task   |
| ------ | ----------------------------- | ---------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| GET    | `/v1/lists/{listId}/tasks`    | listTasks        | Visible                           | P + filters/sort below → 200 Page<Task> + both revisions                                                                 | P06-01 |
| POST   | `/v1/lists/{listId}/tasks`    | createTask       | Visible                           | title, statusId, description?, priority?, assigneeIds?, dueDate?, customFields?, C → 201 Task + revisions/changedTaskIds | P06-02 |
| GET    | `/v1/tasks/{taskId}`          | getTask          | Visible                           | none → 200 Task + both revisions                                                                                         | P06-01 |
| PATCH  | `/v1/tasks/{taskId}`          | updateTask       | Visible                           | mutable built-ins/customFields patch, V+C → 200 Task + revisions/changedTaskIds                                          | P06-02 |
| DELETE | `/v1/tasks/{taskId}`          | archiveTask      | Visible                           | V+C → 204 + invalidation event                                                                                           | P06-02 |
| POST   | `/v1/tasks/{taskId}/move`     | moveTask         | Visible at source and destination | destinationListId, statusId?, customFields patch?, placement, V+C → 200 Task + revisions/changedTaskIds                  | P06-03 |
| POST   | `/v1/tasks/{taskId}/reorder`  | reorderTask      | Visible                           | placement, V+C → 200 Task + revisions/changedTaskIds                                                                     | P06-03 |
| GET    | `/v1/tasks/{taskId}/activity` | listTaskActivity | Visible                           | P → 200 Page<Activity>                                                                                                   | P11-02 |

PATCH allows title, description, statusId, priority, assigneeIds (whole-array replacement), dueDate and customFields (key patch). It excludes primaryListId and position. Empty patches400. Changing status appends to the destination column; same status preserves position. To choose status and exact position together, move supports the same destination list. Reorder stays in the current list/status. Assignment candidates must be members with visibility to the destination, otherwise403; missing/foreign user404. Users cannot assign a hidden task to an unaware member.

Move resolves and validates the complete result before source removal. If explicit statusId is provided it must be visible at destination (400 otherwise). If omitted, preserve current status if available; otherwise choose the first position/key/id in the same category; if absent,400 STATUS_NOT_AVAILABLE. Use optional closed to test the rejected fallback, because core categories are mandatory. Source-only field keys must be cleared with null; required destination values may be supplied in the same payload. All positions, task versions and outbox records commit together; a failed request leaves everything unchanged.

Activity is asynchronous. A successful status update may briefly show a pending refresh state before the feed entry appears. The worker writes once per eventId and emits an invalidation; task writes do not wait for Redis.

### Operational routes

| Method | Path            | operationId  | Access | Success                                                               | Task   |
| ------ | --------------- | ------------ | ------ | --------------------------------------------------------------------- | ------ |
| GET    | `/health/live`  | getLiveness  | Public | 200 {status:"ok"}; process responsive, no secret/config dump          | P01-02 |
| GET    | `/health/ready` | getReadiness | Public | 200 {status:"ready"} after real dependencies/migrations;503 otherwise | P01-02 |

Development `/docs` hosts Swagger UI and is not an SDK operation; disable/expose deliberately per environment. Worker has a private health listener, not a sixth public application or business API.

## Pagination, sorting and filtering

**Cursor-based pagination is the only public pagination mode.** Paginated endpoints accept `cursor` and `limit`; reject `page`, `pageNumber`, `pageSize`, `offset`, `skip`, `take`, duplicate query keys and unknown parameters with 400 VALIDATION_FAILED and the offending query path. The first request omits cursor. Limit is a base-10 integer 1–100 (default 50); reject empty, signed, fractional or duplicate values. Cursor must be nonempty and at most 2,048 characters.

The first page establishes a 15-minute cursor-chain lifetime; later cursors retain that expiry. A cursor carries a supported format version, caller/workspace/resource binding, query fingerprint with normalized defaults, exact ordering tuple and applicable collection revisions/watermark, then is authenticated by the server. Hash the filter/sort/direction/limit configuration instead of placing raw field-search text in the token. Task filters retain the exact supplied JSON scalar representation in that hash (D112), so keep fieldValue unchanged throughout a cursor chain; explicit default sort/direction values are equivalent to omitted defaults. A malformed, tampered, expired, unsupported-version or mismatched cursor gives 400 INVALID_CURSOR with a cursor issue path; a changed mutable collection revision gives 409 CURSOR_STALE. No cursor is an authorization credential: reauthorize and check revisions inside the page's consistent read snapshot.

Use a keyset predicate over the full ordering tuple and explicit null ordering, never SQL OFFSET or a row-count-based resume position. Fetch up to limit+1 **authorized** rows to compute hasNextPage, then return at most limit. Permission filtering must happen before that visible-row limit; hidden rows cannot produce false empty pages or leak totals. An internal ORM result limit (for example limit+1) is compatible with this policy; public offset controls are not.

Responses keep `{items, pageInfo:{nextCursor,hasNextPage}}`, with `hasNextPage === (nextCursor !== null)`. There is no totalPages, numbered-page navigation, previous-page offset or next cursor on an exhausted page. Continue with the returned cursor and exactly the same resource/filter/sort/direction/limit; changing any of them starts a new first-page request.

Resolved status/field schemas and local bounded configuration sets stay complete and unpaginated so validation never uses an incomplete schema. Those operations accept no pagination parameters and reject cursor/limit/page/offset rather than silently ignoring them. All genuinely paginated collections—workspaces, members, grants, tree, tasks and activity—use the single cursor contract.

- Task default sort is manual: status effective position/key/id, task position/id. Board requests statusId per column with manual order. Table supports `sort=dueDate|priority|manual`, `direction=asc|desc` (manual asc only), stable UUID tie-breaks and null dates last in either direction.
- Task query filters: statusId, assigneeId, priority and a **single** custom field. Field filter uses `fieldKey`, `fieldOperator=eq|contains`, `fieldValue` as a JSON-encoded scalar. eq applies to text/number/date/checkbox/single_select; contains applies to one option in multi_select. Decode once and validate against effective schema. Invalid key/type/operator400 with query path. Use bound SQL parameters and known operators.
- Task/tree pages bind configVersion+dataVersion. Before rendering a board, all per-column task responses must match both revisions; status/field responses must match their configVersion. Discard mismatched pages and refetch with bounded retries. Membership/grant pages bind configVersion. Restart and replace accumulated pages on CURSOR_STALE. Do not concatenate pages from different revisions. Empty collections return items=[] and nextCursor=null, hasNextPage=false; no hidden counts or records leak through totals.
- Workspace list pages are live, ordered by membership.createdAt/id; visibility is checked each page. Newly added membership before the cursor appears after refresh. No cross-tenant snapshot is promised.
- Activity order is createdAt/id descending. The first response fixes an upper watermark; subsequent pages stay below it. Normally newer inserts appear after refresh; commit ordering can create late arrivals. Event creation time is assigned at insertion; ties use IDs. This is a live traversal, not a historical snapshot: a transaction that commits late with an older timestamp may appear on a subsequent page or require a refresh. No completeness guarantee across concurrent insertions is implied.

On an expired/stale cursor, discard the accumulated page chain and restart the query while preserving dirty task/configuration forms. Do not repeatedly retry the rejected cursor.

No client-side sort/filter of only the loaded page may pretend to represent the complete table. For board placement at an unloaded edge, use explicit start/end. Relative anchor placement requires adjacent authoritative cards in the selected column; after conflicts refetch before retrying.

## Example requests

Use actual fixture UUIDs returned by the API; these UUIDs illustrate shapes only. They are not a seed promise.

Create a task with a required number and select value:

```json
{
  "title": "Prepare the release checklist",
  "statusId": "00000000-0000-4000-8000-000000000101",
  "priority": "high",
  "customFields": { "effort": 3, "team": "00000000-0000-4000-8000-000000000201" },
  "expectedConfigVersion": 7
}
```

Move, clear a source-only value and fill a destination requirement atomically:

```json
{
  "destinationListId": "00000000-0000-4000-8000-000000000301",
  "placement": { "edge": "start" },
  "customFields": { "source_label": null, "effort": 5 },
  "expectedVersion": 4,
  "expectedConfigVersion": 7
}
```

Override an inherited status without accidentally unhiding it:

```json
{
  "kind": "override",
  "statusId": "00000000-0000-4000-8000-000000000101",
  "name": "Ready",
  "hidden": null,
  "expectedConfigVersion": 7
}
```

## Shared events and second channel

REST schemas/error codes/date rules/permissions apply equally to web and curl. The web-only layer owns routes, drawers, focus, optimistic presentation and URL query preferences. It does not define a separate mutation protocol.

The shared `task.updated` event contract includes schemaVersion, eventId, workspaceId, taskId, taskVersion, actorId, occurredAt, previousListId, currentListId and typed changed-field summary (including previous/current status IDs when changed). The persisted outbox may hold server-only data; WebSocket invalidations send only `{kind: "list", listId, eventId}`, `{kind: "workspace", eventId}`, or `{kind: "resync"}`. They contain no task IDs, task versions, contents or hidden destination metadata. A source-only viewer must not receive destination metadata. `workspace.config.updated` and access revocation notifications invalidate affected caches/subscriptions; room membership is reauthorized at publish time.

[Event examples](api-events.md) document the possible webhook contract and explicitly exclude an outbound sender. The [curl cookbook](../scripts/curl-cookbook.md) uses login, cookie rotation, Bearer tokens, cursor queries and task mutations against this same catalog. P07 handles single-flight refresh/retry-once; no handwritten feature fetches.

## Endpoint definition of done

For each row: shared request/response/error schema → `nestjs-zod` DTO → controller with exact operationId and guard metadata → service/repository behavior and real seam tests → spec export/Spectral → generated client → compile and drift checks. P01-02 provides generation early so every later endpoint follows this order; P07 completed tooling hardening. Pure helpers use unit tests, but they never replace actual Postgres authorization/transaction tests.

Required suites include all 43 operations' auth metadata and typed responses; 401/403/404 distinctions; unknown status400; tenant relation isolation; invalid options/types/required fields; safe config deletion; last-admin/reorder/refresh races; cursor tamper/revision/context checks; and failed mutation rollback. Every generated SDK operation in this inventory must appear exactly once in the generated spec in the committed document. A document row alone proves no endpoint behavior.
