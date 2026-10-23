# Flowboard

A planned self-hosted project management app for learning sound architecture at hobby scale.

**Current state:** Phase 0 workspace and application shells. Next.js, NestJS and an explicitly idle worker use shared TypeScript, ESLint and Prettier configuration. Docker runs the five local services; domain features remain in the task backlog.

The [system design](docs/SYSTEM_DESIGN.md) covers the UI, backend, database ERD and request/event flows. [ClickUp/Asana/Linear research](docs/REFERENCE_ARCHITECTURES.md) explains the public patterns behind it, with sources and explicit limits on what is known.

The implementation-ready [database and ER specification](docs/DATABASE_DESIGN.md) defines all records, tenant keys, migrations and transaction invariants.

The [REST API catalog](docs/API_CATALOG.md) lists operation IDs, schemas, permissions, errors and pagination for backend implementation.

The [Linear-inspired MUI guide](docs/UI_DESIGN.md) maps public UI patterns to our components, screens, state and accessibility tests.

[Workspace RBAC and DTO/entity design](docs/BACKEND_CONTRACTS.md) specifies workspace field inheritance, audit timestamps and decorator-driven Swagger → generated Next.js contracts.

[Field validation reference](docs/FIELD_REFERENCE.md) defines every stored/embedded field and its enforcement layer; paginated APIs use cursor/limit only.

## Local tooling

Use Node 22.23.2 (`nvm use`) and the pinned pnpm version from `package.json`. If pnpm is not already managed by Corepack, enable its shim with `corepack enable pnpm`, then run:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

`pnpm format` applies the shared Prettier rules to every workspace plus root configuration and documentation. The original requirements are preserved verbatim. Tests currently verify package boundaries and real application start/stop behavior. Domain integration and browser user-flow suites arrive with their owning tasks. Runtime libraries expose compiled outputs; tool configurations are directly consumable so first-time builds need no generated files.

Run `pnpm hooks:install` once to enable the repository-local commit-message check. [Code-quality conventions](docs/CODE_QUALITY.md) explain the commit policy, manual checks and CI validation.

## Run the application shells

```sh
NEXT_TELEMETRY_DISABLED=1 pnpm dev
```

Open [the setup page](http://localhost:3000). Next.js reloads page edits; the API and worker compile with TypeScript and restart after successful changes. Stop all three with Ctrl+C. To run one app, use `pnpm dev --filter=@flowboard/web`, `pnpm dev --filter=@flowboard/api` or `pnpm dev --filter=@flowboard/worker`.

| Process | Default address         | Current behavior                                                    |
| ------- | ----------------------- | ------------------------------------------------------------------- |
| Web     | `http://127.0.0.1:3000` | Static setup page; no login or task data yet.                       |
| API     | `http://127.0.0.1:3001` | Signup/login, JWT guard, health and development Swagger at `/docs`. |
| Worker  | TCP `127.0.0.1:3002`    | Process liveness only; queue processing arrives in P11-02.          |

The API and worker accept `HOST` and `PORT`; each app accepts its own `PORT`. Use a filtered command when overriding a port, so the three processes do not contend for it. For a production-mode shell, run `pnpm build`, then `pnpm --filter @flowboard/web start` (or `api`/`worker`). The Next production server binds all interfaces by default; set `HOSTNAME=127.0.0.1` to restrict it locally. The API requires `DATABASE_URL` and `REDIS_URL`, migrates before listening and serves `/health/live` and dependency-aware `/health/ready`. `API_DOCS=true` enables `/docs`; it defaults on in development and off in hosted production. Local Compose explicitly enables it.

The shared ESLint presets are exported as `@flowboard/config-eslint/node` and `/next`; compiler presets as `@flowboard/config-typescript/{node,nest,next,library}.json`. Workspace boundary violations fail lint. App manifests export their metadata only; apps are not reusable libraries.

## Run with Docker

Start Docker, then run from the repository root:

```sh
docker compose up --build
```

This builds separate web, API and worker images and starts PostgreSQL and Redis. Open [Flowboard](http://localhost:3000); the API listens on port 3001. Application containers run as non-root. PostgreSQL, Redis and the worker are private to the Compose network. The local database defaults in `.env.example` require no file copy and are for development only.

The API applies checked-in Prisma migrations, then seeds the local demo once before listening. The worker waits for API health. API health checks PostgreSQL and Redis with bounded timeouts; worker health remains process liveness until queue processing in P11-02. No successful domain response is provided yet.

Local demo accounts are `alice@example.com` (admin), `bob@example.com` and `carol@example.com` (members), plus `dan@example.com` in a second tenant. Their development-only password is `FlowboardDemo123!`, stored as individually salted Argon2id hashes. Alice is also a member of the second tenant. The main tenant contains 24 tasks across three lists, four field definitions across all four scopes, inherited/overridden statuses, one private list and one list denying Bob. The second tenant has three tasks. Use `POST /v1/auth/login` with `{ "email": "alice@example.com", "password": "FlowboardDemo123!" }` and an allowed `Origin` header (for example `http://localhost:3000`). `POST /v1/auth/signup` also accepts `name` and `workspaceName`; it creates a separate workspace/admin/default statuses. Both return a 15-minute access token and set an httpOnly refresh cookie. Use `POST /v1/auth/refresh` with the refresh cookie and allowed Origin to rotate it; use `POST /v1/auth/logout` to revoke the family and expire the cookie. Both accept an empty body. A reused refresh cookie revokes the whole family, so concurrent refresh requests must be coordinated by the future browser transport.

`DEMO_SEED` defaults to `true` only in local Compose. Leave it `false` on hosted environments. A completed seed marker is committed atomically with the data; later or concurrent boots preserve your edits. Migrations use `DATABASE_URL_UNPOOLED` when supplied (Neon's direct connection), while runtime queries use `DATABASE_URL` (which may be pooled). For explicit local maintenance, export those URLs and run `pnpm db:migrate`, or `DEMO_SEED=true pnpm db:seed` after migration. Neither command resets data.

`docker compose down` stops the stack and retains database/Redis volumes. To expose only the development datastore ports to host tools, use `docker compose -f compose.yaml -f compose.local.yaml up -d postgres redis`; these ports bind to localhost only. Do not start both the container apps and host development apps on the same ports.

Run `pnpm docker:check` for an isolated image/build/start/restart check. It uses random published ports, verifies non-root users and datastore persistence, removes its own containers, and leaves its uniquely named test volumes intact. It never targets the development project's volumes.

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

Generate contracts with `pnpm gen:api`. The isolated Nest bootstrap exports real DTO/controller metadata without database, Redis or secrets. `pnpm openapi:check` validates the committed document and Spectral conventions; normal builds also reject stale OpenAPI/client output. The generated Hey API SDK and TanStack Query options are committed and never hand-edited. Response serialization rejects invalid server output with a sanitized 500. Public errors use the shared envelope, including malformed/oversized requests.

Auth runtime requires `AUTH_SECRET` (32+ bytes) and comma-separated `AUTH_ALLOWED_ORIGINS`. Hosted environments use a newly generated secret, exact HTTPS UI origins, `AUTH_ALLOW_INSECURE_HTTP=false`, and `DEMO_SEED=false`. The local Compose credentials and secret are deliberately public development defaults. The API refuses the known local secret when secure mode is selected. Browser access tokens belong in memory; refresh credentials never appear in JSON and only SHA-256 digests are stored. Signup/login enforce Origin and return `Cache-Control: no-store`; credential failures are generic401. Login limits are 100 per socket IP and 10 per IP/email per 15 minutes; signup is 10 per IP/hour. Refresh and logout each allow 120 per IP/minute. 429 includes `Retry-After`. Forwarded IP headers are untrusted; configure an authenticated proxy policy in P07-04 before hosted proxy auth, rather than accepting arbitrary client headers.

OIDC can replace password verification and map the provider's stable subject to User while retaining workspace membership, the permission layer and local session boundary. Provider tokens must be verified server-side; a claimed external role never replaces the DB role. Membership management and session-only recovery are implemented in P02-03.
