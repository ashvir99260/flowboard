# Flowboard

A planned self-hosted project management app for learning sound architecture at hobby scale.

**Current state:** Phase 0 workspace foundation. Shared packages, TypeScript, ESLint and Prettier are set up; the app shells and Docker environment are tracked in the next tasks. Domain features are not implemented.

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

`pnpm format` applies the shared Prettier rules to every workspace plus root configuration and documentation. The original requirements are preserved verbatim. Early tests verify the workspace/configuration; each feature will add its real behavioral suites. Runtime packages expose compiled outputs; tool configurations are directly consumable so first-time builds need no generated files.

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
