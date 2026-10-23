# Flowboard

A planned self-hosted project management app for learning sound architecture at hobby scale.

**Current state:** Phase 0 workspace and application shells. Next.js, NestJS and an explicitly idle worker use shared TypeScript, ESLint and Prettier configuration. Domain features and the Docker environment are not implemented yet.

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

The API and worker accept `HOST` and `PORT`; each app accepts its own `PORT`. Use a filtered command when overriding a port, so the three processes do not contend for it. For a production-mode shell, run `pnpm build`, then `pnpm --filter @flowboard/web start` (or `api`/`worker`). The Next production server binds all interfaces by default; pass `--hostname 127.0.0.1` to restrict it locally. No database or Redis connection is needed for these shells.

The shared ESLint presets are exported as `@flowboard/config-eslint/node` and `/next`; compiler presets as `@flowboard/config-typescript/{node,nest,next,library}.json`. Workspace boundary violations fail lint. App manifests export their metadata only; apps are not reusable libraries.

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
