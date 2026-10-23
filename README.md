# Flowboard

A planned self-hosted project management app for learning sound architecture at hobby scale.

**Current state:** Phase 0 workspace and application shells. Next.js, NestJS and an explicitly idle worker use shared TypeScript, ESLint and Prettier configuration. Docker runs the five local services; domain features remain in the task backlog.

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

## Run the application shells

```sh
NEXT_TELEMETRY_DISABLED=1 pnpm dev
```

Open [the setup page](http://localhost:3000). Next.js reloads page edits; the API and worker compile with TypeScript and restart after successful changes. Stop all three with Ctrl+C. To run one app, use `pnpm dev --filter=@flowboard/web`, `pnpm dev --filter=@flowboard/api` or `pnpm dev --filter=@flowboard/worker`.

| Process | Default address         | Current behavior                                                           |
| ------- | ----------------------- | -------------------------------------------------------------------------- |
| Web     | `http://127.0.0.1:3000` | Static setup page; no login or task data yet.                              |
| API     | `http://127.0.0.1:3001` | Nest boots; all routes return 404 until the typed HTTP platform in P01-02. |
| Worker  | TCP `127.0.0.1:3002`    | Process liveness only; queue processing arrives in P11-02.                 |

The API and worker accept `HOST` and `PORT`; each app accepts its own `PORT`. Use a filtered command when overriding a port, so the three processes do not contend for it. For a production-mode shell, run `pnpm build`, then `pnpm --filter @flowboard/web start` (or `api`/`worker`). The Next production server binds all interfaces by default; set `HOSTNAME=127.0.0.1` to restrict it locally. No database or Redis connection is needed for these shells.

The shared ESLint presets are exported as `@flowboard/config-eslint/node` and `/next`; compiler presets as `@flowboard/config-typescript/{node,nest,next,library}.json`. Workspace boundary violations fail lint. App manifests export their metadata only; apps are not reusable libraries.

## Run with Docker

Start Docker, then run from the repository root:

```sh
docker compose up --build
```

This builds separate web, API and worker images and starts PostgreSQL and Redis. Open [Flowboard](http://localhost:3000); the API listens on port 3001. Application containers run as non-root. PostgreSQL, Redis and the worker are private to the Compose network. The local database defaults in `.env.example` require no file copy and are for development only.

API/worker health currently means process liveness. Database-aware readiness, migrations and seed data arrive in P01-02/P01-05; the worker does not process jobs until P11-02. No placeholder migration or successful domain response is provided.

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

## Independent releases and hosting

Merges to `main` publish only affected applications: `api/vX.Y.Z`, `web/vX.Y.Z`, and `worker/vX.Y.Z`, with separate GHCR images and source/digest manifests. Shared runtime package changes release their consumers; documentation/test-only changes do not. Pull requests run read-only verification first.

Local development uses Docker PostgreSQL. The selected hosted setup is Vercel (UI), Northflank (API, worker, Redis), and Neon (PostgreSQL). Provider accounts are not linked yet. See [delivery and hosting](docs/DELIVERY.md) for setup, environment variables, image selection, and interrupted-release recovery.

Production CD is wired after successful publication: Vercel builds the exact web commit and Northflank deploys API/worker image digests. It stays disabled until provider credentials and IDs are connected. See [CI/CD activation and recovery](docs/CI_CD.md).

Future `dev → qa → stage → prod` promotion will reuse one build and inject configuration at runtime. Docker remains the local development/test setup. See the [build-once contract and current limitations](docs/PROMOTION.md).
