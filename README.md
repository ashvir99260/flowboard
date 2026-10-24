# Flowboard

A self-hosted project management app for learning sound architecture at hobby scale.

**Current state:** Backend features through Phase 6 are implemented and tested: authentication, workspace membership, tenant isolation, container permissions, inherited statuses and custom fields, and task creation, editing and moves. Shared MUI display/input components, light/dark themes, typed form examples, tree items, cards and confirmation dialogs are available in the development playground. The web supports signup/login, session restoration, workspace switching and a paginated permission-aware sidebar. Selected lists offer a Kanban board with accessible card moves and a sortable table with resolved custom-field columns. The worker remains idle until its activity-processing task. The generated client includes isolated session and refresh handling; the same-origin browser proxy is implemented, while task editing, configuration screens and realtime delivery remain in the backlog.

Boards display only a consistent set of status, field and task revisions. A concurrent configuration or task change restarts loading, with a visible retry after repeated changes. Refreshing the board, returning to the tab or reconnecting starts again at the first page of every column. Use each column's **Load more** button to load additional cards; column counts describe loaded cards. Wider boards scroll inside their own region on small screens.

Use a card's **Drag** handle to change status or order. Keyboard users can pick up with Space or Enter, move with arrow keys, drop with Space or Enter, and cancel with Escape. Dropping outside the columns cancels. The **Move** button provides the same operations plus another visible destination list, placement controls and required custom-field corrections. Fields unavailable in the destination are explicitly listed before clearing. Saving disables repeat actions for that task; rejected moves roll back their own preview and show the error without discarding the form. Every completed save refreshes affected open boards. Moving to the end of a partially loaded column may put the card on a later page.

Choose **List** to see built-in fields and the list's actual resolved custom fields, labeled **Inherited** or **Local**. Sort by due date, priority or board order; empty due dates stay last. Apply one typed custom-field filter, or clear it to see all tasks. Multi-select filters match one selected option. View, sort and filter stay in the URL for sharing and browser history; cursors remain internal. **Load more tasks** adds the next server page. Changing lists or filters, refreshing, returning to the tab and completed moves start a new consistent page chain. On narrow screens, focus the table region and scroll horizontally to reach every column.

The [system design](docs/SYSTEM_DESIGN.md) covers the UI, backend, database ERD and request/event flows. [ClickUp/Asana/Linear research](docs/REFERENCE_ARCHITECTURES.md) explains the public patterns behind it, with sources and explicit limits on what is known.

The implementation-ready [database and ER specification](docs/DATABASE_DESIGN.md) defines all records, tenant keys, migrations and transaction invariants.

The [REST API catalog](docs/API_CATALOG.md) lists operation IDs, schemas, permissions, errors and pagination for backend implementation.

The [Linear-inspired MUI guide](docs/UI_DESIGN.md) maps public UI patterns to our components, screens, state and accessibility tests.

[Workspace RBAC and DTO/entity design](docs/BACKEND_CONTRACTS.md) specifies workspace field inheritance, audit timestamps and decorator-driven Swagger → generated Next.js contracts.

[Backend coding guide](docs/BACKEND_GUIDELINES.md) defines the feature-based NestJS layout, module boundaries, DTO/entity rules and Swagger workflow used for backend changes.

[Field validation reference](docs/FIELD_REFERENCE.md) defines every stored/embedded field and its enforcement layer; paginated APIs use cursor/limit only.

## Local tooling

Use Node 22.23.2 (`nvm use`) and the pinned pnpm version from `package.json`. If pnpm is not already managed by Corepack, enable its shim with `corepack enable pnpm`, then run:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm typecheck
pnpm --filter @flowboard/web exec playwright install --with-deps chromium
pnpm test
pnpm format:check
```

`pnpm format` applies the shared Prettier rules to every workspace plus root configuration and documentation. The original requirements are preserved verbatim. Tests cover package boundaries, application start/stop, shared domain rules, and real PostgreSQL/Redis integration for the implemented backend. Browser user-flow suites cover authentication, workspace/list navigation, session expiry and responsive keyboard controls. Runtime libraries expose compiled outputs; tool configurations are directly consumable so first-time builds need no generated files.

On resource-constrained laptops, `pnpm test --concurrency=2` runs the same complete suite with fewer simultaneous Turbo tasks. Run Docker checks afterward. CI keeps its parallel build, lint, type and test jobs.

Run `pnpm hooks:install` once to enable the repository-local commit-message check. [Code-quality conventions](docs/CODE_QUALITY.md) explain the commit policy, manual checks and CI validation.

## Run locally

For the first local setup, create private configuration files from the examples. `cp -n` preserves any files you already have:

```sh
cp -n .env.example .env
cp -n apps/api/.env.example apps/api/.env
cp -n apps/worker/.env.example apps/worker/.env
cp -n apps/web/.env.example apps/web/.env.local
docker compose -f compose.yaml -f compose.local.yaml up -d postgres redis
pnpm dev
```

The root `.env` configures Compose. The API and worker load their own `.env` when launched with their `dev` or `start` scripts; Next.js loads `.env.local`. Existing process environment variables override file values. The Node services also work without a file when their environment is supplied externally. Restart Node development processes after editing their env files. These private files are ignored by Git and excluded from Docker images. Keep database credentials/ports consistent between root and app files if you customize them, and never put server secrets in the web file. The local API example enables migrations, demo seeding and Swagger; hosted deployments use injected secrets and disable local-only settings.

Open [Flowboard](http://localhost:3000). Next.js reloads page edits; the API and worker compile with TypeScript and restart after successful changes. Stop all three with Ctrl+C. To run one app, use `pnpm dev --filter=@flowboard/web`, `pnpm dev --filter=@flowboard/api` or `pnpm dev --filter=@flowboard/worker`.

The development-only [component playground](http://localhost:3000/playground) demonstrates shared statuses, priorities, assignees, dates, custom fields and empty/error states in light and dark themes. It uses local sample props and makes no API requests. Production returns 404 for this route.

| Process | Default address         | Current behavior                                                              |
| ------- | ----------------------- | ----------------------------------------------------------------------------- |
| Web     | `http://localhost:3000` | Login/signup, workspace picker, visible tree, Kanban and sortable task table. |
| API     | `http://localhost:3001` | Auth, workspaces, hierarchy, statuses, fields, tasks and Swagger at `/docs`.  |
| Worker  | TCP `localhost:3002`    | Process liveness only; queue processing arrives in P11-02.                    |

The API and worker accept `HOST` and `PORT`; each app accepts its own `PORT`. Use a filtered command when overriding a port, so the three processes do not contend for it. For a production-mode shell, run `pnpm build`, then `pnpm --filter @flowboard/web start` (or `api`/`worker`). The Next production server binds all interfaces by default; set `HOSTNAME=localhost` to restrict it locally. The API requires `DATABASE_URL` and `REDIS_URL`, migrates before listening and serves `/health/live` and dependency-aware `/health/ready`. `API_DOCS=true` enables `/docs`; it defaults on in development and off in hosted production. Local Compose explicitly enables it.

The shared ESLint presets are exported as `@flowboard/config-eslint/node` and `/next`; compiler presets as `@flowboard/config-typescript/{node,nest,next,library}.json`. Workspace boundary violations fail lint. App manifests export their metadata only; apps are not reusable libraries.

## Debugging backend requests

API, database and worker events use Pino-backed structured JSON on stdout. `LOG_LEVEL=info` is the default; `LOG_LEVEL=debug` includes operation start/completion/failure and health requests. For local Compose, run `LOG_LEVEL=debug docker compose up --build`, then `docker compose logs -f api worker`. With local Node processes, use `LOG_LEVEL=debug pnpm dev --filter=@flowboard/api`.

Each HTTP response contains a server-generated `X-Request-Id`. Search that ID in logs to follow HTTP → auth → Redis/database work. Records include safe error codes, status, duration, operation, and DB-verified user/workspace IDs when available. Request bodies, tokens, cookies, SQL, query strings and raw exceptions are excluded. [Logging reference](docs/LOGGING.md) explains levels and failure diagnosis.

## Run with Docker

Start Docker Desktop (or Docker Engine with the Compose v2 plugin). Run the commands below from the repository root. Docker installs dependencies and builds the apps, so this workflow does not require Node.js or pnpm on your host. Stop any running `pnpm dev` processes first to free ports 3000 and 3001.

Create the optional local configuration file, preserving it if it already exists, then build and start all five services:

```sh
cp -n .env.example .env
docker compose up --build
```

This runs in the foreground and shows the logs; Ctrl+C stops the services. To run in the background and wait for health checks instead:

```sh
docker compose up --build -d --wait
```

Compose builds separate web, API and worker images and starts PostgreSQL and Redis. The first build can take a few minutes. Once the services are healthy, open:

| Service         | Local URL                                                                |
| --------------- | ------------------------------------------------------------------------ |
| Web application | [http://localhost:3000](http://localhost:3000)                           |
| API Swagger UI  | [http://localhost:3001/docs](http://localhost:3001/docs)                 |
| API readiness   | [http://localhost:3001/health/ready](http://localhost:3001/health/ready) |

Sign in to the web with a demo account, choose a workspace, then select a list. The sidebar includes only containers visible to that account. Use **Board** for status columns or **List** for the task table; task editing and configuration screens follow in Phases 9–10. Swagger exposes all implemented backend endpoints. Application containers run as non-root. Without the development override, PostgreSQL, Redis and the worker are private to the Compose network.

Docker Compose reads the root `.env`; the per-app `.env` and `.env.local` files are only needed for host development and are excluded from images. Without a root `.env`, Compose uses the development defaults in `compose.yaml`. To use different published ports, set `WEB_PORT` and `API_PORT` in the root file. An explicit `AUTH_ALLOWED_ORIGINS` must list both full browser origins, such as `http://localhost:3100,http://localhost:3101`. Without an explicit allowlist, Compose derives both localhost origins from the published ports. Keep these development credentials local.

For Swagger, open **Try it out**, replace illustrative credentials with a real account (for example the seeded Alice account below), and select **Execute**. The local allowlist includes `http://localhost:3001` because browsers send the Swagger page's own origin; changing the displayed Origin input cannot override that browser header. A `403 ORIGIN_REJECTED` means the page's exact origin is missing from the API's `AUTH_ALLOWED_ORIGINS`. Update the root `.env` for Docker or `apps/api/.env` for host development, then recreate/restart the API. Refresh and logout use the httpOnly cookie set by a successful login in the same browser. Keep hosted allowlists explicit and restricted to your intended HTTPS origins.

### Live code updates while developing

Use the development override when you want saved local source edits to appear automatically:

```sh
mkdir -p packages/database/src/generated
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

Open the same [web URL](http://localhost:3000) or [Swagger UI](http://localhost:3001/docs). Next.js updates the page as you save; the API and worker recompile and restart. Shared source changes rebuild the affected packages and update their consumers. Compilation errors appear in the logs; correct the source to resume. Database contents survive these reloads.

Development also exposes the datastores to tools on your computer:

| Service    | Host address     | Port override in root `.env` |
| ---------- | ---------------- | ---------------------------- |
| PostgreSQL | `localhost:5432` | `POSTGRES_PORT`              |
| Redis      | `localhost:6379` | `REDIS_PORT`                 |

Use the database name, user and password configured in the root `.env`. The ports bind only to this computer's loopback interface. If a port is already occupied, choose another value in the root `.env`, then reapply `docker compose -f compose.yaml -f compose.dev.yaml up -d --wait`. Container-to-container connections continue using `postgres:5432` and `redis:6379`.

Development containers restart after watcher failures, including filesystem-watch errors while generated files are replaced. A restart can briefly interrupt the page or API; logs show the failure and recovery.

This mode mounts the web's `app/` and `src/`, the API/worker `src/` and their shared source directories read-only. The one-time `mkdir` creates an ignored mount point; generated Prisma files stay in container memory, with Linux dependencies and compiled output also kept inside containers. Private app env files are not mounted. Production-style startup without this override continues to use built images. The override works with Compose 2.20; it does not require Compose Watch.

After changing dependencies, the lockfile, Dockerfiles, TypeScript/Next configuration or generated OpenAPI artifacts, rebuild explicitly:

```sh
docker compose -f compose.yaml -f compose.dev.yaml up --build -d --wait
```

Root `.env` changes require the same command to recreate affected services. Use the same two `-f` options with `logs`, `ps` and `down`; for example, `docker compose -f compose.yaml -f compose.dev.yaml logs -f api worker`. Stop host `pnpm dev` before switching to Docker development, since both use the same ports.

### Logs, restart and shutdown

| Action                                        | Command                                 |
| --------------------------------------------- | --------------------------------------- |
| Show services and health                      | `docker compose ps`                     |
| Follow app logs (Ctrl+C exits the log viewer) | `docker compose logs -f web api worker` |
| Stop services, keeping containers and data    | `docker compose stop`                   |
| Start again or apply root `.env` changes      | `docker compose up -d --wait`           |
| Rebuild after source or dependency changes    | `docker compose up --build -d --wait`   |
| Stop and remove containers, keeping data      | `docker compose down`                   |

PostgreSQL and Redis use named volumes, so your data survives normal stop, rebuild and shutdown commands. Avoid `docker compose down -v` unless you intend to erase the local data. Production-style containers need a rebuild for source edits; use the development override above for automatic source updates.

Use `localhost` in local browser URLs and host-side connection settings. Compose keeps numeric loopback addresses for host port publishing, and container health probes use IPv4 to match their listeners. These settings keep services local while avoiding differences in IPv4/IPv6 hostname resolution. Container listeners retain `0.0.0.0` so the Compose network can reach them.

### Initialization and demo accounts

The API applies checked-in Prisma migrations, then seeds the local demo once before listening. The worker waits for API health. API health checks PostgreSQL and Redis with bounded timeouts; worker health remains process liveness until queue processing in P11-02. Task-management endpoints are available through the API; task boards/editing remain in the backlog.

Local demo accounts are `alice@example.com` (admin), `bob@example.com` and `carol@example.com` (members), plus `dan@example.com` in a second tenant. Their development-only password is `FlowboardDemo123!`, stored as individually salted Argon2id hashes. Alice is also a member of the second tenant. The main tenant contains 24 tasks across three lists, four field definitions across all four scopes, inherited/overridden statuses, one private list and one list denying Bob. The second tenant has three tasks. Use `POST /v1/auth/login` with `{ "email": "alice@example.com", "password": "FlowboardDemo123!" }` and an allowed `Origin` header (for example `http://localhost:3000`). `POST /v1/auth/signup` also accepts `name` and `workspaceName`; it creates a separate workspace/admin/default statuses. Both return a 15-minute access token and set an httpOnly refresh cookie. Use `POST /v1/auth/refresh` with the refresh cookie and allowed Origin to rotate it; use `POST /v1/auth/logout` to revoke the family and expire the cookie. Both accept an empty body. A reused refresh cookie revokes the whole family, so the client session transport coordinates concurrent refresh requests.

`DEMO_SEED` defaults to `true` only in local Compose. Leave it `false` on hosted environments. A completed seed marker is committed atomically with the data; later or concurrent boots preserve your edits. Migrations use `DATABASE_URL_UNPOOLED` when supplied (Neon's direct connection), while runtime queries use `DATABASE_URL` (which may be pooled). For explicit local maintenance, export those URLs and run `pnpm db:migrate`, or `DEMO_SEED=true pnpm db:seed` after migration. Neither command resets data.

To run the apps with `pnpm dev` while keeping only PostgreSQL and Redis in Docker, follow [Run the application shells](#run-the-application-shells). That workflow uses `compose.local.yaml` to expose datastore ports to host tools. Full Docker startup uses `compose.yaml` alone. Do not run container apps and host development apps on the same ports.

Run `pnpm docker:check` for an isolated image/build/start/restart check. It uses random published ports, verifies non-root users and datastore persistence, removes its own containers, and leaves its uniquely named test volumes intact. It never targets the development project's volumes.

Run `pnpm docker:dev:check` to verify live app/shared-package edits and compile-error recovery against a temporary source copy. It uses separate images and random ports, preserves your source and running stack, and retains only its isolated data volumes after cleanup.

## Releases and hosted environments

[The delivery plan](docs/DELIVERY.md) defines independent API, web and worker releases and container tags. It also covers local PostgreSQL, Neon connection strings for hosted environments, and the proposed free-tier hosting layout. Current rollout status is tracked in P00-04 through P00-06; a local Docker build does not create a hosted deployment.

## Project guide

| Document                                                | Use it for                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| [Architecture](ARCHITECTURE.md)                         | Understand components, boundaries, request/event flows and change impact. |
| [Implementation plan](docs/PLAN.md)                     | Read the full planned design and phased delivery.                         |
| [Task backlog](docs/TASKS.md)                           | Work through small, ordered tasks with acceptance and dependencies.       |
| [Original requirements](docs/REQUIREMENTS.md)           | Consult the preserved user brief.                                         |
| [Requirement traceability](docs/REQUIREMENTS_MATRIX.md) | Connect each requirement to its tasks and verification.                   |
| [Decisions](docs/DECISIONS.md)                          | Understand explicit choices and tradeoffs.                                |
| [Agent instructions](AGENTS.md)                         | Apply repository-specific AI guardrails.                                  |
| [Development workflow](docs/DEVELOPMENT_WORKFLOW.md)    | Follow the task, test, review, evidence and commit process.               |
| [Quality gates](docs/QUALITY_GATES.md)                  | Know which checks must pass and when they become executable.              |
| [Task and evidence templates](docs/TASK_TEMPLATE.md)    | Add consistent, reviewable work records.                                  |
| [Evidence directory](docs/evidence/README.md)           | Inspect what has actually been checked.                                   |
| [System Design companion](docs/system-design.docx)      | Read the template-based Word overview; Markdown remains canonical.        |

Future README sections for one-command startup, ports, demo users, API examples, operations and Docker tests are tracked in P12-02, with runnable setup added as the relevant foundation tasks land. Documentation is not a claim those capabilities already work.

## Local code navigation

Optional [Graphify navigation](docs/GRAPHIFY.md) builds a local code graph with `graphify update .`. Graphs, reports and caches stay Git-ignored; Codex uses focused queries to find relevant source.

The [AI coding tool guide](docs/AI_TOOLS.md) adds Serena symbol navigation, pinned ast-grep searches and local Gitleaks checks. Optional [Reverse Engineer Anything](docs/REA.md) inspects built JavaScript artifacts through an isolated local CLI. Tool installations, reports and local agent state stay out of Git.

## Independent releases and hosting

Merges to `main` publish only affected applications: `api/vX.Y.Z`, `web/vX.Y.Z`, and `worker/vX.Y.Z`, with separate GHCR images and source/digest manifests. Shared runtime package changes release their consumers; documentation/test-only changes do not. Pull requests run read-only verification first.

Local development uses Docker PostgreSQL. The selected hosted setup is Vercel (UI), Northflank (API, worker, Redis), and Neon (PostgreSQL). Initial hosting is a shared preview; Vercel/Northflank setup and live verification are still pending. See [delivery and hosting](docs/DELIVERY.md) for setup, environment variables, image selection, and interrupted-release recovery.

Preview CD is wired after successful publication: Vercel builds the exact web commit as a preview and Northflank deploys API/worker image digests to preview services. No production promotion runs. It stays disabled until provider credentials and IDs are connected. See [CI/CD activation and recovery](docs/CI_CD.md).

Future `dev → qa → stage → prod` promotion will reuse one build and inject configuration at runtime. Docker remains the local development/test setup. See the [build-once contract and current limitations](docs/PROMOTION.md).

Generate contracts with `pnpm gen:api`. The isolated Nest bootstrap exports real DTO/controller metadata without database, Redis or secrets. `pnpm openapi:check` regenerates into a temporary directory, validates that fresh document with Spectral, compares it byte-for-byte with the committed spec, and always removes temporary files. Normal builds run the same check and also reject stale generated client output. The rules require unique operation IDs, versioned domain paths, typed errors, and cursor/limit plus an items/pageInfo envelope for paginated collections. Bounded status/field configuration collections are the documented pagination exceptions. The generated Hey API SDK and TanStack Query options are committed and never hand-edited. `pnpm client:check` compares a temporary regeneration, including missing or extra files. Public imports are `@flowboard/api-client/sdk`, `/types`, and `/tanstack-query`; the root export remains available. The pinned generator exposes `listTasksQueryKey`, `listTasksOptions`, `listTasksInfiniteOptions` and `createTaskMutation`, which are consumed by TanStack hooks. It does not generate React hooks directly. Response serialization rejects invalid server output with a sanitized 500. Public errors use the shared envelope, including malformed/oversized requests.

The public `@flowboard/api-client/session` export provides `setupClient({ onSessionChange })` in browsers, defaulting to the current web origin plus `/api`. Server callers supply explicit `baseUrl` and `origin`. Pass its `client` to generated SDK functions or TanStack options; use its `login`, `signup`, `refresh`, `switchWorkspace` and `logout` helpers for coordinated cookie operations. Sessions stay in memory. Concurrent401s share one refresh and replay once;403s and network errors do not refresh. Cancelled requests and responses belonging to an old login/workspace are discarded. `getSession` returns a copy; `dispose` closes an instance permanently.

In browsers, Web Locks serialize cookie changes and localStorage stores only an opaque revision to invalidate other tabs. Login/logout/workspace changes require other tabs to reauthenticate; tokens are never shared. Missing or failing browser coordination fails closed. Connect `onSessionChange` to query-cache/socket cleanup in the forthcoming UI integration. For SSR, create one client per incoming request; a custom request-scoped cookie adapter is required for refresh because Node fetch has no browser cookie jar. Browser REST requests use the same-origin proxy described below.

Browser requests to `/api/v1/*` pass through a server-only Next route to API `/v1/*`. Set `API_INTERNAL_URL` to the API HTTP(S) origin and `WEB_ALLOWED_ORIGINS` to exact, comma-separated web origins in the **web server runtime**. For local host development use `http://localhost:3001` and `http://localhost:3000`; Compose sets the internal API origin to `http://api:3001`. For a Vercel preview, configure its exact HTTPS URL here and in the API's `AUTH_ALLOWED_ORIGINS`, and use the hosted API HTTPS origin. These settings are read per request, so a built image can be promoted without baking environment URLs into browser assets.

The proxy forwards only approved headers and the host-only `flowboard_refresh` cookie, preserves separate Set-Cookie values, validates mutation Origins, caps bodies at 256 KiB, disables caching and rejects redirects/ambiguous paths. Swagger and CLI clients keep calling the API directly. Forwarded client-IP headers are discarded: hobby previews conservatively share the proxy's socket-IP rate-limit bucket until a provider-authenticated IP policy is added. The browser transport tests use a controlled upstream to verify cookie ownership/rotation; the complete product UI E2E path remains in later tasks.

Auth runtime requires `AUTH_SECRET` (32+ bytes) and comma-separated `AUTH_ALLOWED_ORIGINS`. Hosted environments use a newly generated secret, exact HTTPS UI origins, `AUTH_ALLOW_INSECURE_HTTP=false`, and `DEMO_SEED=false`. The local Compose credentials and secret are deliberately public development defaults. The API refuses the known local secret when secure mode is selected. Browser access tokens belong in memory; refresh credentials never appear in JSON and only SHA-256 digests are stored. Signup/login enforce Origin and return `Cache-Control: no-store`; credential failures are generic401. Login limits are 100 per socket IP and 10 per IP/email per 15 minutes; signup is 10 per IP/hour. Refresh and logout each allow 120 per IP/minute. 429 includes `Retry-After`. Forwarded IP headers are untrusted; configure an authenticated proxy policy in P07-04 before hosted proxy auth, rather than accepting arbitrary client headers.

Workspace administration is available through Swagger and the generated client: `GET /v1/me`, cursor-paginated `GET /v1/workspaces`, and `GET/POST/PATCH/DELETE /v1/workspaces/{workspaceId}/members` (PATCH/DELETE include `{userId}`). Administrators manage memberships; ordinary members can list names and roles but see only their own email. Mutations require the `expectedConfigVersion` returned by the member page. The last administrator cannot be removed or demoted. Removing a member clears their grants/assignments and records task changes atomically while retaining historical activity.

Create a 48-hour invitation with `POST /v1/workspaces/{workspaceId}/invitations` using `{email,role,expectedConfigVersion}`. Privately share the returned token; it is shown once and only its digest is stored. The recipient signs in, then sends `{token}` to `POST /v1/invitations/accept`. Acceptance requires the same email, rejects expired/reused tokens and never upgrades an existing member. It does not select the new workspace or send email; an invitation form is a later UI task.

Select a joined workspace with `POST /v1/auth/switch-workspace` and `{workspaceId}`, sending both the current bearer token and refresh cookie with an allowed Origin. Switching rotates that cookie within the same login family and preserves its expiry; tokens for the previous selected workspace stop working. Other browser/login families are unchanged. If the selected membership is removed, a still-valid token can use `/v1/me`, list workspaces, accept an invite and switch to another membership. Normal workspace access and refresh remain forbidden until recovery or a fresh login. Member-page cursors bind the current configuration revision; discard and restart after `CURSOR_STALE`. Cursors expire after 15 minutes and cannot be reused with another caller, resource or page limit.

OIDC can replace password verification and map the provider's stable subject to User while retaining workspace membership, the permission layer and local session boundary. Provider tokens must be verified server-side; a claimed external role never replaces the DB role. Team-based grants can later add team memberships to PermissionService without duplicating authorization in controllers.

Hierarchy containers now support `POST /v1/nodes`, `GET/PATCH/DELETE /v1/nodes/{nodeId}` through Swagger and the generated client. Container creation, editing and archival require a workspace administrator. Members can read containers they can see through the full ancestor chain. Create uses `{name,type,parentId,visibility?,expectedConfigVersion}`: spaces have a null parent, folders require a space, and lists require a folder. Responses include the node plus `configVersion` and `dataVersion`. PATCH accepts name/visibility with both `expectedVersion` and `expectedConfigVersion`; unchanged values preserve revisions. Sibling positions are assigned by the server.

DELETE requires both expected versions and soft-deletes the entire live subtree and its tasks using `archivedAt`. History, field/status configuration, grants and assignments remain stored. Normal reads hide archived nodes and nodes beneath archived ancestors; repeated deletion returns404. Stale versions return409 with no partial change. Reparenting is described below; restore remains outside the MVP.

The visible sidebar API is `GET /v1/tree?limit=50`. It returns a flat page of live authorized containers plus the virtual workspace root, configuration revision and data revision. Parents precede children: order is depth, then the full ancestor path using numeric sibling positions and UUID ties. Follow `pageInfo.nextCursor` with the same limit; a changed revision returns `409 CURSOR_STALE` and requires restarting. There are no total counts or hidden-node placeholders. Each page uses one repeatable-read snapshot; the hobby-sized implementation reads the live workspace graph before filtering and paging, so its cost grows with workspace size.

Visibility is inherited along the entire ancestor chain. A deny on any ancestor hides that whole subtree. Every private container on the path requires its own explicit allow; allowing a child does not bypass a private or denied parent. Administrators bypass grants within their active workspace. Same-tenant denied direct reads return403; missing, archived and foreign targets return404.

Administrators manage explicit grants using `GET/PUT /v1/nodes/{nodeId}/grants` and `DELETE /v1/nodes/{nodeId}/grants/{userId}`. PUT accepts `{userId, mode: "allow" | "deny", expectedConfigVersion}`; DELETE accepts `{expectedConfigVersion}`. GET uses cursor-only pagination. Grant changes recheck current membership and role after taking the workspace lock, bump configuration once and record an outbox invalidation in the same transaction. Same-value PUT and absent-grant DELETE preserve revisions after validation. Grants control visibility; they do not grant administrative or configuration editing rights.

`POST /v1/nodes/{nodeId}/reorder` accepts `{placement, expectedVersion, expectedConfigVersion}` for administrators. Placement is exactly `{edge:"start"}`, `{edge:"end"}`, `{beforeId:"sibling-uuid"}` or `{afterId:"sibling-uuid"}`. Anchors must be distinct live siblings under the same parent. The server assigns integer positions, increments every changed sibling once and updates workspace revisions atomically. Canonical no-ops preserve timestamps and revisions; legacy ties/gaps normalize to dense positions. Reparenting uses the separate move endpoint below.

`POST /v1/nodes/{nodeId}/move` lets administrators reparent a folder to a space or a list to a folder. It requires `{parentId,placement,expectedVersion,expectedConfigVersion}` and uses the same strict sibling placement forms. Spaces retain the workspace root. Missing/foreign/archived parents or anchors return404; wrong types/self anchors return400; stale or incompatible inherited configuration returns409.

The API tentatively applies the new parent inside its transaction, validates every resulting live scope and descendant task, and rolls everything back if any status, field value or retained assignee becomes invalid. It validates empty scopes too. Grants and task data stay attached to their existing resources; visibility follows the new ancestor chain. A successful move updates changed sibling/node versions once and advances both workspace revisions once. Descendant task versions and archived history remain unchanged.

The shared `resolveStatuses` function walks an explicit workspace → space → folder → list path. It merges by immutable key while retaining the canonical status ID/category. A first definition supplies name, color and position; later nonnull values override individual attributes. Null inherits. A hidden status remains in the internal map so a deeper `hidden:false` can restore it; a display-only edit leaves it hidden. Visible results sort by position, key and ID and must include not_started, active and done (closed is optional). The function returns either valid items or typed validation issues. Each item includes the introducing owner and per-attribute override provenance for future configuration previews. Database mutation safety and the status endpoints are the next implementation tasks.

### Custom-field configuration

Administrators manage complete local field definitions at `/v1/scopes/{ownerType}/{ownerId}/fields` (GET/POST) and `.../{fieldId}` (PATCH/DELETE). Owners are workspace, space, folder or list. Visible members read `/v1/lists/{listId}/resolved-fields`. These bounded collections are complete and reject pagination parameters; each returns the same-snapshot `configVersion`. Writes require `expectedConfigVersion`.

Resolution walks workspace → space → folder → list. The nearest matching key replaces the **whole definition**, including type, required flag and options; options are never merged. Results sort by position, key, then ID and include source/audit metadata plus `isInherited`. Empty schemas are valid. IDs, keys and owners are immutable; PATCH preserves omitted attributes and rejects nulls. A type change may require replacing options in the same request.

Before committing configuration, the API validates all affected live schemas and task values. In-use removal or incompatible fallback/type/option/required changes return409 with field paths and leave data unchanged. Compatible inherited fallback may succeed. To make a field required, first add it as optional, populate valid values, then enable required. Use the task PATCH endpoint to populate values before enabling the required flag.

### Task writes

Visible workspace members can create tasks with `POST /v1/lists/{listId}/tasks`, edit with `PATCH /v1/tasks/{taskId}`, and archive with `DELETE /v1/tasks/{taskId}`. Create requires title, resolved statusId and expectedConfigVersion; description defaults to empty, priority to none, dueDate to null, and assignees/customFields to empty. Required fields still need valid values. PATCH/DELETE also require expectedVersion. The server owns tenant, identity, position, versions and audit timestamps.

PATCH preserves omitted fields, replaces the complete assignee array, clears dueDate with null, and patches customFields with null to remove an optional value. It validates the complete result, including retained assignees. Status changes append to the destination column; ordinary edits retain position. Unchanged edits preserve all versions and timestamps. Archive keeps history and assignments but hides the task from normal reads. Use the placement endpoints below for cross-list moves and explicit ordering.

Use `GET /v1/workspaces/{workspaceId}/members?assignableToListId={listId}` for eligible assignees. The caller must see the list; candidates must see every ancestor. Filtering happens before pagination, and cursors bind the list. Foreign members return404; same-workspace members without list access return403 with the original input index.

Writes recheck access and configuration under the workspace lock. Each real mutation advances dataVersion once, leaves configVersion unchanged, and commits its outbox event atomically. Creation emits `task.created`; edits/archives emit `task.updated` with sanitized changes and no raw title, description or field values. Worker dispatch and live browser updates remain later tasks.

### Task placement

`POST /v1/tasks/{taskId}/move` accepts `{destinationListId,statusId?,customFields?,placement,expectedVersion,expectedConfigVersion}`. `POST /v1/tasks/{taskId}/reorder` accepts placement and both expected versions within the current list/status. Placement is exactly `{edge:"start"}`, `{edge:"end"}`, `{beforeId:"task-uuid"}` or `{afterId:"task-uuid"}`. Source, destination, anchor and retained assignees must satisfy current access rules.

A move retains a destination-visible status, otherwise uses the first destination status in the same category (position/key/ID order). With no match it returns400; an explicit valid status may be supplied. Missing destination-required values and source-only values reject until supplied or explicitly cleared in customFields. An anchor must belong to the destination status column; hidden/foreign/archived anchors fail without a partial move.

Both affected columns are renumbered densely using all live tasks. Every changed task advances its version once; changedTaskIds includes shifted siblings. The command advances dataVersion once, preserves configVersion and commits all events atomically. Canonical no-ops preserve audits/revisions. Existing task-page cursors must restart after a successful mutation. A stale task/configuration version returns409; refetch before retrying.

### Task reads

`GET /v1/lists/{listId}/tasks` returns a cursor page; `GET /v1/tasks/{taskId}` returns task details. Both check the task's live list and ancestors and include `configVersion` and `dataVersion` from the same database snapshot. Assignees contain only ID/name. Task writes use the same scoped repository and access policy.

Task pages accept `limit` (1–100), `cursor`, `sort=manual|dueDate|priority`, and `direction=asc|desc` (manual supports asc). Manual order follows resolved statuses, then card position/ID. Due dates place nulls last in either direction; ties use ascending IDs. Filters are `statusId`, `assigneeId`, `priority`, or one complete `fieldKey`/`fieldOperator`/`fieldValue` triplet. Field values are JSON-encoded scalars: `3`, `false` or `"Platform"`; `eq` matches a typed scalar, and `contains` matches one multi-select option ID. Invalid field types/options return400 with paths.

Continue with the returned cursor and identical query. Cursors expire after fifteen minutes and are bound to the caller, workspace, list and query. A changed configuration or task-data revision returns409 CURSOR_STALE; restart from the first page. No page numbers, offsets or hidden totals are exposed.
