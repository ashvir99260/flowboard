# Flowboard Task Backlog

Status: Phase 0 foundation implementation authorized and in progress. Execute top to bottom, one task at a time. Dependencies name the technical prerequisites; they do not authorize skipping ahead. Paths below are planned deliverables; check their current implementation and evidence. Small supporting edits are allowed only within the task's stated goal and must be recorded in its completion note.

Canonical behavior is in [PLAN.md](PLAN.md), the brief in [REQUIREMENTS.md](REQUIREMENTS.md), and defaults in [DECISIONS.md](DECISIONS.md). Read [AGENTS.md](../AGENTS.md) before execution.

## Definition of done for every task

- [ ] Write the next behavioral test at the named public seam and observe its expected failure; implement one passing slice at a time. Documentation/config-only tasks use relevant structural checks instead.
- [ ] Run `pnpm build`, `pnpm lint`, `pnpm test`; fix all failures. Before the scaffold creates these scripts, record the exact available bootstrap checks rather than claim these commands passed.
- [ ] For every endpoint: shared schema → Zod DTO → typed controller response and explicit operationId → guard metadata → spec regenerated → client regenerated → at least one behavioral test. Never defer contract artifacts to a later phase.
- [ ] Run named task-specific checks, inspect the diff, update docs/TODOs, tick the task only when acceptance passes, and commit only its changes.
- [ ] Give three lines: delivered behavior; checks and result; next task or actual blocker. Link the task's evidence record beneath its completion note; the commit containing that record identifies the task in Git history without a self-referential hash.

The checklist above is a reusable protocol, not a task to mark globally complete. Each task below carries its own completion checkbox.

## Planning

- [x] **P-000 — Plan and repository guardrails**
  - **Goal:** Turn the complete brief into an implementable design and durable AI instructions; perform no application implementation.
  - **Files:** `docs/REQUIREMENTS.md`, `docs/PLAN.md`, `docs/TASKS.md`, `docs/DECISIONS.md`, `AGENTS.md`, `docs/system-design.docx`.
  - **Dependencies:** None.
  - **Acceptance:** All requirements map to tasks; choices and generated-code exceptions are explicit; template companion is rendered/checked; root guardrails preserve the supplied Postman instruction. No phase is marked started.
  - **Validation:** Markdown links/task IDs/dependencies checked, diff reviewed, companion visual QA. Build/lint/tests are unavailable in the initial repository and are not reported as passing.
  - **Commit:** `docs: plan flowboard architecture and guardrails`.
  - **Completion evidence (22 October 2026):** 46 unique backlog IDs and all required task fields/dependency order/local links verified; source brief preserved exactly. Two independent reviews reconciled. Eight-page companion rendered and visually checked. No package manifest exists yet, so build/lint/application tests were not runnable. Phase 0 remains unstarted.

- [x] **P-001 — Architecture reference and delivery harness**
  - **Goal:** Make future implementation easy to navigate, verify and resume using stable requirement IDs, quality gates and evidence records.
  - **Requirements:** H01–H06 in [REQUIREMENTS_MATRIX.md](REQUIREMENTS_MATRIX.md); original product rows remain planned.
  - **Files:** `ARCHITECTURE.md`, `AGENTS.md`, `README.md`, `docs/{DEVELOPMENT_WORKFLOW,REQUIREMENTS_MATRIX,QUALITY_GATES,TASK_TEMPLATE}.md`, `docs/evidence/README.md`, `docs/evidence/P-001.md`, `docs/{PLAN,DECISIONS,TASKS}.md`.
  - **Dependencies:** P-000.
  - **Acceptance:** Architecture describes the existing planned design without introducing product changes; every requirement maps to implementation tasks and verification; documented workflow covers preflight, one-task execution, tests, review, evidence and handoff; active and future automated checks are clearly distinguished. No application scaffolding is added.
  - **Validation:** Check document links, unique requirement/task IDs, dependency ordering, matrix coverage, status consistency and diff; independent review of architecture/process. Build/lint/application tests remain unavailable until Phase 0.
  - **Commit:** `docs: add architecture and delivery harness`.
  - **Completion evidence (22 October 2026):** [P-001 record](evidence/P-001.md). Architecture/process/coverage reviewed; 13 Markdown documents, 138 local links, 47 task records, 92 planned requirement rows and six documentation outcomes checked. Application implementation remains unstarted.

## Phase 0 — Workspace and runnable infrastructure

- [x] **P00-01 — Workspace graph and shared configuration**
  - **Goal:** Establish all requested workspaces plus shared database/Prettier packages, strict TypeScript, Node/Next ESLint presets and package-owned Turbo tasks.
  - **Requirements:** R08–R10, R22 and R93; foundation portions only until app shells and boundary enforcement land.
  - **Files:** root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `.gitignore`, `.npmrc`; `packages/config-{typescript,eslint,jest}/**`; `apps/{api,web,worker}/{package.json,tsconfig.json}`; `packages/{contracts,database,openapi,api-client,ui}/{package.json,tsconfig.json,src/index.ts}`.
  - **Dependencies:** P-001.
  - **Acceptance:** Exact package versions and compatibility recorded; every workspace has exports and a real minimal build/config-copy step. All workspaces consume shared Prettier configuration with format/check commands. Empty library entry points are explicitly scaffolding, tracked by subsequent tasks. Root scripts delegate to Turbo; cache outputs and edges are defined.
  - **Validation:** Clean frozen install; build/lint/test entry points run; verify Turbo dry-run graph, package resolution and cache restore. No fake test-success scripts.
  - **Commit:** `chore: scaffold flowboard workspaces`.
  - **Completion evidence:** [P00-01 verification](evidence/P00-01.md): all 12 workspace builds/lints/typechecks/format checks pass; five native structural tests pass; cache restoration and frozen install verified.

- [x] **P00-02 — Enforce package and import boundaries**
  - **Goal:** Turn the primary AI architecture rules into executable lint checks.
  - **Files:** `packages/config-eslint/src/{index,boundaries}.mjs`, `eslint.config.mjs`, `packages/config-eslint/test/boundaries.test.mjs`, `.github/pull_request_template.md`, `AGENTS.md`.
  - **Dependencies:** P00-01.
  - **Acceptance:** Invalid web→API, worker→API, UI→client, contracts→framework and direct Prisma imports fail. Zod is allowed in contracts. Only the OpenAPI scripts may use the dedicated API tooling export. Type-only violations also fail; relative escapes cannot bypass rules.
  - **Validation:** Deliberate valid/invalid import fixtures prove rules; standard task gate passes after removing violations.
  - **Commit:** `chore: enforce workspace architecture boundaries`.
  - **Completion evidence:** [P00-02 verification](evidence/P00-02.md).

- [x] **P00-03 — Minimal runnable application shells**
  - **Goal:** Boot Nest, Next and the worker process with honest operational state and no domain endpoints.
  - **Files:** `apps/api/src/{main,app.module}.ts`, `apps/web/app/{layout,page}.tsx`, `apps/worker/src/main.ts`, app manifests/compiler/Turbo configs, `apps/{api,web,worker}/test/bootstrap.test.*`, `packages/config-jest/src/{process,no-network}.mjs`, shared lint/format support, `README.md`, `docs/DECISIONS.md`.
  - **Dependencies:** P00-02.
  - **Acceptance:** Shells compile/start and terminate cleanly; scaffold page identifies setup status. Worker does not claim activity processing exists. TCP/process readiness only until P01-02. TODO references point to P08-03/P11-02.
  - **Validation:** Start/stop smoke tests, no unexpected outbound connections, standard gate.
  - **Commit:** `chore: add runnable application shells`.
  - **Completion evidence:** [P00-03 verification](evidence/P00-03.md): three real application processes, shared Next/Node tooling, 44 passing tests including half-open shutdown, and restored Next build cache.

- [x] **P00-04 — Pruned Docker images and five-service Compose**
  - **Goal:** Provide the first working one-command development topology.
  - **Files:** `apps/{api,web,worker}/Dockerfile`, `compose.yaml`, `.dockerignore`, `.env.example`, `apps/{api,web,worker}/.env.example`, `scripts/check-compose.mjs`, `README.md`.
  - **Dependencies:** P00-03.
  - **Acceptance:** Multi-stage `turbo prune --docker` images run non-root. Five services have meaningful healthchecks and healthy dependencies; DB/Redis use named volumes/internal ports. Local demo defaults work without hand-copying environment files; secrets are service-specific. Migration startup is explicitly tracked by P01-05.
  - **Validation:** Compose config, all images build, clean `docker compose up --build`, health wait and restart smoke; standard gate.
  - **Commit:** `chore: add docker compose development stack`.
  - **Completion evidence:** [P00-04 verification](evidence/P00-04.md): three non-root images, all five services healthy, browser assets served, datastore restart persistence and 44 root tests pass.

- [x] **P00-05 — Independent application release planning**
  - **Goal:** Compute per-application semantic releases from source changes and published release baselines.
  - **Requirements:** R94–R95.
  - **Files:** `packages/release-tools/**`, application release metadata, `docs/DELIVERY.md`, `docs/DECISIONS.md`.
  - **Dependencies:** P00-04.
  - **Acceptance:** API-only and web-only changes are independent; runtime shared dependencies propagate correctly; lockfile changes are selective. Versions use application-specific tags, Conventional Commits and published baselines. Documentation-only changes skip. Retries and stale/diverged histories fail safely or resume without duplicate versions.
  - **Validation:** Behavioral fixtures for app-only, shared, selective dependency, rename/delete, initial release, feature/breaking/patch, no-op, partial retry and stale runs; standard gate.
  - **Commit:** `feat: plan independent application releases`.
  - **Completion evidence:** [P00-05 verification](evidence/P00-05.md): 31 planner fixtures and 75 total tests pass; publication remains P00-06.

- [x] **P00-06 — CI, independent image publication and hosted setup guide**
  - **Goal:** Validate pull requests and publish only affected application images, tags and GitHub Releases after main merges.
  - **Requirements:** R94–R97.
  - **Files:** `.github/workflows/**`, `packages/release-tools/**`, `docs/DELIVERY.md`, `README.md`, environment examples.
  - **Dependencies:** P00-05.
  - **Acceptance:** Read-only PR checks; serialized main publication with narrowly scoped write permissions; version/SHA image tags and digest recorded per release; idempotent failure recovery. No production credentials needed for release builds. Document local PostgreSQL, Neon runtime/direct migration URLs and the selected free-tier hosting setup, including honest limits and required secret names. Provider connection is explicit, never a dummy successful deployment.
  - **Validation:** Workflow lint, publication orchestration tests using a local Git/registry boundary or controlled API fixtures, Docker checks, full standard gate; remote publication only when authorized main workflow runs.
  - **Commit:** `ci: publish independent app images and releases`.
  - **Completion evidence:** [P00-06 verification](evidence/P00-06.md): 89 tests, actionlint, standard gates and five-service Docker acceptance pass; live publication remains P00-07.

- [x] **P00-08 — Deploy released applications through CI/CD**
  - **Goal:** Extend passing CI and independent publication with production deployment to the selected Vercel/Northflank hosts.
  - **Requirements:** R98; preserves R94–R97.
  - **Files:** `.github/workflows/delivery.yml`, `apps/web/vercel.json`, `packages/release-tools/src/{deploy*,github}.ts`, release-tool tests/config, `docs/CI_CD.md`, `docs/DELIVERY.md`, `docs/DECISIONS.md`, evidence and matrix.
  - **Dependencies:** P00-06. P00-07 is an external post-merge verification and can follow this implementation.
  - **Acceptance:** Main-only production job follows CI, Docker and release success; PRs never deploy. Published manifests select exact app digests/commits. Unchanged apps skip. Missing settings, stale runs, provider errors and failed rollouts fail safely. Retries and later unrelated merges reconcile pending releases; already-current provider versions do not roll out again. CD is explicitly disabled until credentials are connected.
  - **Validation:** Controlled provider HTTP/clock fixtures for selection, payloads, readiness, errors, stale runs and retries; actionlint; build/lint/test/type/format gates.
  - **Commit:** `ci: deploy released apps to selected hosts`.
  - **Completion evidence:** [P00-08 verification](evidence/P00-08.md): 117 tests, actionlint, standard gates and five-service Docker acceptance pass. The original production target is superseded by P00-13; initial live preview verification is P00-14. P00-09 remains future production verification.

- [x] **P00-10 — Define immutable promotion and runtime configuration**
  - **Goal:** Record the user's local-Docker and future trunk-based build-once requirements without provisioning environments or claiming the existing source deploy path complies.
  - **Requirements:** R99; clarifies R95 and R98.
  - **Files:** `docs/PROMOTION.md`, `docs/PLAN.md`, `docs/DECISIONS.md`, `docs/CI_CD.md`, `docs/DELIVERY.md`, `ARCHITECTURE.md`, `README.md`, task/matrix/evidence records.
  - **Dependencies:** P00-08 as current-state input; no live-host credentials required for this documentation task.
  - **Acceptance:** Distinguish local Docker from hosted packaging; specify unchanged artifact promotion, four target environments, runtime/public/secret configuration, Node environment naming, and current Vercel/pipeline gaps. Do not change hosts or build four environments under the user's conditional future request.
  - **Validation:** Documentation consistency, source-backed technical constraints, local links, formatting and independent review. No application behavior claimed.
  - **Commit:** `docs: define build-once environment promotion`.
  - **Completion evidence:** [P00-10 verification](evidence/P00-10.md): promotion/runtime contract, current implementation gaps and future tasks documented; no four-environment implementation claimed.

- [x] **P00-13 — Configure the initial hosted preview**
  - **Goal:** Deliver the user's initial Vercel/Northflank/Neon preview path independently of future four-environment promotion.
  - **Requirements:** R98; preserves R94–R97 and keeps R99 deferred.
  - **Files:** `.github/workflows/delivery.yml`, root/Turbo/release-tool scripts, `packages/release-tools/src/{deploy-cli,deployment-providers}.ts`, provider tests, `docs/{CI_CD,DELIVERY,PROMOTION,PLAN,DECISIONS,TASKS,REQUIREMENTS_MATRIX}.md`, `README.md`, `ARCHITECTURE.md`, task evidence.
  - **Dependencies:** P00-08, P00-10 and the user's explicit initial-preview clarification.
  - **Acceptance:** Passing main releases deploy to the GitHub `preview` environment when enabled. Vercel creates/reuses a preview from the released SHA and reports its ready URL without production promotion; an empty project fails before Vercel can force its first deployment to production. Northflank retains exact-digest deployment to preview services. Failures, stale runs and retries remain safe. Document free-tier setup and current shell limitations; live deployment is separately evidenced.
  - **Validation:** Behavioral HTTP fixtures for preview creation, retry, URL/target validation, failures and stale runs; actionlint; build/lint/test/type/format gates.
  - **Commit:** `ci: target initial hosted previews`.
  - **Completion evidence:** [P00-13 verification](evidence/P00-13.md): 122 tests, standard gates and actionlint pass; empty-project bootstrap guard reviewed. Live preview remains P00-14.

- [x] **P00-15 — Parallel CI on free public-repository runners**
  - **Goal:** Run all workspace build, lint, test and type checks independently in parallel without paid runners or an organization subscription.
  - **Requirements:** R98; preserves R94–R97 and the preview deployment gate.
  - **Files:** `.github/workflows/delivery.yml`, `packages/release-tools/test/deployment-gate.test.mjs`, `docs/{CI_CD,DECISIONS,TASKS,REQUIREMENTS_MATRIX}.md`, `docs/evidence/P00-15.md`.
  - **Dependencies:** P00-13 and the user's explicit parallel/free-CI request.
  - **Acceptance:** A fail-fast-disabled matrix runs root build/lint/test/typecheck/format commands across all workspaces. Docker checks run concurrently. Every job uses standard `ubuntu-24.04`; entry jobs skip private repositories. No paid runner group, cache service, organization or billing change is introduced. Publication waits for every check and Docker; preview deployment still waits for publication.
  - **Validation:** Workflow contract regression tests, actionlint, root build/lint/test/type/format checks, independent review; confirm public repository visibility and inspect the pushed PR workflow when available.
  - **Commit:** `ci: parallelize workspace checks on free runners`.
  - **Completion evidence:** [P00-15 verification](evidence/P00-15.md): 123 tests, standard gates, actionlint and independent review pass. GitHub public visibility confirmed; paid settings unchanged.

- [ ] **P00-14 — Connect and verify the initial hosted preview**
  - **Goal:** Put the current foundation online on the selected preview hosts.
  - **Requirements:** R96–R98.
  - **Files:** `docs/evidence/P00-14.md`, `docs/TASKS.md`, requirement matrix; credentials remain only in provider/GitHub secret settings.
  - **Dependencies:** P00-13, P00-07 for automated released-image deployment, authenticated provider access and free-tier availability.
  - **Acceptance:** Vercel preview, Northflank API/worker/Redis and region-matched Neon exist; runtime secrets are scoped to preview. A real workflow deploys released versions, retries reuse them, and the web URL serves the foundation page. State explicitly that auth/tasks/queues/migrations are not implemented yet. No paid plan, real production site, production data or production credentials are used. Vercel’s mandatory production-labeled first deployment requires an explicitly reviewed bootstrap in the dedicated preview-only project; CI does not perform it.
  - **Validation:** Real provider resources, workflow records and external HTTP/liveness checks; do not substitute mock results for live evidence.
  - **Commit:** `docs: record initial hosted preview`.

- [ ] **P00-11 — Implement environment-neutral artifacts and runtime config**
  - **Goal:** Build each application candidate once and keep all target-specific settings out of its bytes.
  - **Requirements:** R99.
  - **Files:** App packaging/build scripts, runtime-config schemas and web bootstrap, deployment artifact tooling and tests; exact files selected with the hosting decision.
  - **Dependencies:** P00-10 and explicit request to implement the future promotion path.
  - **Acceptance:** One immutable digest per app candidate; no target-specific build inputs; validated server settings and a safe dynamic public bootstrap. Two runtime configurations use identical bytes. The selected host supports the artifact without rebuilding it.
  - **Validation:** Missing/invalid config, browser secret exclusion, runtime changes, cache isolation, artifact hash equality and build-toolchain-disabled deployment; standard gates.
  - **Commit:** `feat: build environment-neutral app artifacts`.

- [ ] **P00-12 — Promote selected artifacts across deployment environments**
  - **Goal:** Add trunk-based `dev → qa → stage → prod` deployment without environment branches or rebuilds.
  - **Requirements:** R99.
  - **Files:** Promotion workflow/tooling, environment configuration documentation and tests.
  - **Dependencies:** P00-11; selected hosts and environment approval policy.
  - **Acceptance:** Every promotion names an existing artifact digest and verifies the previous environment's acceptance for it; serialize per environment, preserve version identity, record configuration revision and support safe retry/rollback. No source-based build occurs during promotion.
  - **Validation:** Same-digest progression, approval/ordering violations, concurrent or stale candidates, failed retry and rollback; standard and workflow gates. Live verification needs connected targets.
  - **Commit:** `ci: promote immutable artifacts across environments`.

- [ ] **P00-09 — Connect and verify production deployment**
  - **Goal:** Enable and verify live deployment after provider accounts and targets are connected.
  - **Requirements:** R98.
  - **Files:** `docs/evidence/P00-09.md`, `docs/TASKS.md`, requirement matrix; secret values never enter files.
  - **Dependencies:** P00-07, P00-08, the selected build-once hosting path (P00-11; P00-12 when four environments are enabled), and provider credentials/target IDs. The old source-build activation path is deferred under the latest clarification.
  - **Acceptance:** A main run deploys the released app(s), reports real ready provider deployments, and a retry/unchanged app does not trigger an unrelated rollout.
  - **Validation:** Live workflow/provider deployment records and externally reachable service checks; record honest product-shell limitations.
  - **Commit:** `docs: record live continuous deployment`.

- [ ] **P00-07 — Verify the first main-branch publication**
  - **Goal:** Record the first real application tags, GHCR digests and GitHub Releases after this workflow is merged.
  - **Requirements:** R94–R95.
  - **Files:** `docs/evidence/P00-07.md`, `docs/REQUIREMENTS_MATRIX.md`, `docs/TASKS.md`; workflow fixes only if the first run fails.
  - **Dependencies:** P00-06 and merge to main.
  - **Acceptance:** The main run passes and publishes API, web and worker `0.1.0` releases with matching source SHA/digest manifests. A retry does not allocate new versions. Record run/release links without exposing credentials. Provider deployment is separate and requires connected accounts.
  - **Validation:** Inspect the real workflow run, tags, release manifests and GHCR digests. Apply standard gates if implementation fixes are needed.
  - **Commit:** `docs: record first independent releases`.

## Phase 1 — Contracts, persistence and tenancy

- [ ] **P01-01 — Foundation contracts before HTTP endpoints**
  - **Goal:** Define shared enums, errors, pagination and immutable transport primitives.
  - **Files:** `packages/contracts/src/{enums,errors,pagination,identifiers,dates,index}.ts`, `packages/contracts/test/foundations.test.ts`.
  - **Dependencies:** P00-04.
  - **Acceptance:** Zod schemas infer types for all requested enums, error codes/envelope, cursor page and strict IDs/calendar dates. Domain schemas reject unsupported values and unexpected identity fields.
  - **Validation:** Literal valid/invalid fixtures including leap dates, enum typos, negative/oversized limits and malformed issue paths; standard gate.
  - **Commit:** `feat: define shared transport contracts`.

- [ ] **P01-02 — HTTP platform and early contract generation**
  - **Goal:** Establish real health endpoints, global error/validation/response handling and the minimum export/client pipeline required by every following endpoint.
  - **Files:** `apps/api/src/platform/**`, `apps/api/src/spec-bootstrap.ts`, `packages/contracts/src/health.ts`, `packages/openapi/{scripts/export.ts,openapi.json,.spectral.yaml}`, `packages/api-client/{openapi-ts.config.ts,src/generated/**}`, affected package manifests/Turbo config.
  - **Dependencies:** P01-01.
  - **Acceptance:** `/health/live`, `/health/ready` and development `/docs` have typed schemas. Runtime readiness checks actual dependencies; spec bootstrap imports the real controller/DTO registry without sockets/DB/Redis. `pnpm gen:api` works, explicit operationIds and error schemas appear, and generated client compiles. Infrastructure URL exceptions are explicit.
  - **Validation:** Supertest error-envelope/response tests; export/generation with runtime dependencies unavailable; malformed response fails safely; standard gate.
  - **Commit:** `feat: establish typed api platform and generation`.

- [ ] **P01-03 — Relational schema and migrations**
  - **Goal:** Persist the model with tenant-safe relations before repositories/endpoints use it.
  - **Files:** `packages/database/prisma/{schema.prisma,migrations/**}`, `packages/database/src/{client,index}.ts`, `packages/database/test/{migration,schema}.integration.test.ts`, `compose.test.yaml`.
  - **Dependencies:** P01-02.
  - **Acceptance:** All PLAN entities exist, including stable status identity, field JSONB, versions, join tables and outbox. Composite FKs prevent cross-tenant relations. Owner shape checks and indexes are checked in. A dedicated real Postgres test database is isolated from development.
  - **Validation:** Migrate empty database, verify constraints by rejected inserts, restart/reapply migration, inspect required indexes; standard gate with real Postgres.
  - **Commit:** `feat: add tenant safe database schema`.

- [ ] **P01-04 — Fail-closed tenant repositories and test harness**
  - **Goal:** Make tenant scoping the only persistence entry point for tenant data.
  - **Files:** `packages/database/src/{tenant-context,tenant-database,transaction,identity-repository}.ts`, `packages/database/src/repositories/**`, `packages/database/test/tenancy.integration.test.ts`, `apps/api/test/support/{database,fixtures,app}.ts`.
  - **Dependencies:** P01-03.
  - **Acceptance:** Missing context fails; reads/writes/counts/pagination/relations/transaction access inject workspace scope; raw Prisma is not exported to apps. Workspace locking is transaction-bound. Fixtures/harness clean up an isolated database and work with Testcontainers or the documented test service.
  - **Validation:** Tenant A cannot read/update/delete/link tenant B records; forged workspace criteria cannot override context; callback transaction keeps scoping. Standard gate.
  - **Commit:** `feat: centralize tenant scoped persistence`.

- [ ] **P01-05 — Seed-once data and migration startup**
  - **Goal:** Make clean boot reproducible and demonstrate all major scenarios with real persisted data.
  - **Files:** `packages/database/prisma/seed.ts`, `packages/database/src/initialize.ts`, `packages/database/test/seed.integration.test.ts`, `apps/api/docker/entrypoint.sh`, `compose.yaml`, `README.md`.
  - **Dependencies:** P01-04.
  - **Acceptance:** Alice/Bob/Carol, two tenants, 2 spaces/2 folders/3 main lists, 24 tasks, inherited/overridden statuses, optional closed, 3+ multilevel fields and private/denied lists exist. Migrate then seed once under a lock before API ready; repeated/concurrent boot preserves edits. Seed disabled outside demo mode.
  - **Validation:** Assert counts/relations/field validity, two parallel initializers, second boot after editing data, migration failure prevents readiness; standard gate and Compose boot.
  - **Commit:** `feat: initialize database with repeatable demo data`.

## Phase 2 — Authentication and membership

- [ ] **P02-01 — Signup, login and default-deny authentication**
  - **Goal:** Establish password identity, atomic workspace creation and verified tenant context.
  - **Files:** `packages/contracts/src/auth.ts`, `apps/api/src/auth/{auth.module,auth.controller,auth.service,auth.guard,auth.dto,public.decorator}.ts`, `apps/api/test/auth.e2e-spec.ts`, generated artifacts.
  - **Dependencies:** P01-05.
  - **Acceptance:** Signup creates workspace/admin/default statuses atomically; login verifies Argon2id and normalizes email. JWT claims/audience/issuer/expiry checked, membership role read from DB. Guard is default-on with named public exceptions. Credential rate limiting and redacted logs exist.
  - **Validation:** Correct login; duplicate normalized email; wrong password; expired/forged token; unauthenticated domain route 401; body cannot set acting role/workspace; failed signup rolls back. Endpoint DoD and standard gate.
  - **Commit:** `feat: add workspace aware authentication`.

- [ ] **P02-02 — Rotating refresh sessions and logout**
  - **Goal:** Provide cookie refresh without token reuse or unsafe replay.
  - **Files:** `apps/api/src/auth/{session.service,cookie-policy,origin.guard}.ts`, auth controller/contracts, `apps/api/test/refresh.e2e-spec.ts`, generated artifacts.
  - **Dependencies:** P02-01.
  - **Acceptance:** Random refresh digest only; atomic single-use rotation; reuse revokes family; logout invalidates session/cookie. Cookie Secure/SameSite/httpOnly policy, Origin validation and credentialed CORS are explicit. Auth endpoints never disclose password/token digests.
  - **Validation:** Cookie flags, rotation, replay, concurrent use, revoked/deleted membership, missing/bad Origin and cross-site refresh; endpoint DoD and standard gate.
  - **Commit:** `feat: rotate refresh sessions securely`.

- [ ] **P02-03 — Membership, invitations and workspace switching**
  - **Goal:** Support real multi-workspace identity and admin-managed access.
  - **Files:** `packages/contracts/src/workspaces.ts`, `apps/api/src/workspaces/**`, `apps/api/src/permissions/{permission.guard,permission.service}.ts`, `apps/api/test/workspaces.e2e-spec.ts`, generated artifacts.
  - **Dependencies:** P02-02.
  - **Acceptance:** `/me`, paginated workspaces/members, add/invite/accept/remove/role change and verified workspace switch work. Invite is an expiring manual-share link with digest storage and email match. Establish the one PermissionGuard/PermissionService with the membership/admin policy now; P03-02 extends it to containers. Remove departing members' grants/assignments atomically, bump affected task versions/emit outbox updates, and retain activity. No controller-local authorization, self-escalation or last-admin removal.
  - **Validation:** Expired/reused invite, wrong email, cross-tenant switch, member cannot grant admin, concurrent last-admin demotions, removed member token fails; endpoint DoD and standard gate.
  - **Commit:** `feat: manage workspace membership and invites`.

## Phase 3 — Hierarchy and authorization

- [ ] **P03-01 — Strict hierarchy CRUD and archive**
  - **Goal:** Implement space/folder/list records with valid parents and soft deletion.
  - **Files:** `packages/contracts/src/nodes.ts`, `apps/api/src/hierarchy/{hierarchy.module,nodes.controller,hierarchy.service,nodes.dto}.ts`, `apps/api/test/hierarchy.e2e-spec.ts`, generated artifacts.
  - **Dependencies:** P02-03.
  - **Acceptance:** Create/read/rename/archive nodes; exact parent types enforced; IDs cannot cross tenants. Archive removes whole subtree/tasks from normal reads atomically. Until P03-02 adds complete member visibility, all new node routes are admin-only through the established PermissionGuard, including reads. Reparenting waits for P06-05.
  - **Validation:** Skip-level/cycle/self-parent attempts, archived ancestors, cross-tenant parent, repeat archive behavior and rollback; endpoint DoD and standard gate.
  - **Commit:** `feat: add validated hierarchy containers`.

- [ ] **P03-02 — Central permission policy, grants and visible tree**
  - **Goal:** Make tree/direct access agree on ancestor-aware visibility.
  - **Files:** `packages/contracts/src/{permissions,tree}.ts`, `apps/api/src/permissions/**`, `apps/api/src/hierarchy/tree.controller.ts`, `apps/api/test/permissions.e2e-spec.ts`, generated artifacts.
  - **Dependencies:** P03-01.
  - **Acceptance:** PermissionGuard + PermissionService are the only access policy. Admin bypass is tenant-local; private ancestors require explicit allow; ancestor deny prunes subtree. Paginated flat tree contains visible nodes/parents only. Grants are admin-managed and transactions recheck authorization.
  - **Validation:** Alice sees all; Bob lacks private list; Carol allow works; Bob direct denied list 403; child allow cannot bypass parent deny/private; foreign IDs 404; counts/grants do not leak. Endpoint DoD and standard gate.
  - **Commit:** `feat: enforce container permissions centrally`.

- [ ] **P03-03 — Deterministic sibling reordering**
  - **Goal:** Order visible hierarchy without client-controlled positions or race corruption.
  - **Files:** `packages/contracts/src/ordering.ts`, `apps/api/src/hierarchy/ordering.service.ts`, nodes controller, `apps/api/test/node-ordering.e2e-spec.ts`, generated artifacts.
  - **Dependencies:** P03-02.
  - **Acceptance:** Neighbor-ID move API assigns integer positions transactionally, validates sibling set, increments version and has stable ID tie-breaks.
  - **Validation:** First/last/empty position, wrong-parent/foreign anchors, duplicate anchors, stale version and concurrent reorder; endpoint DoD and standard gate.
  - **Commit:** `feat: reorder hierarchy siblings atomically`.

## Phase 4 — Scoped statuses

- [ ] **P04-01 — Pure status resolution with stable identity**
  - **Goal:** Define one algorithm for API decisions and UI previews.
  - **Files:** `packages/contracts/src/{statuses,status-resolution}.ts`, `packages/contracts/test/status-resolution.test.ts`.
  - **Dependencies:** P03-03.
  - **Acceptance:** `resolveStatuses` merges root-to-leaf by key; display overrides preserve identity/category; hidden/unhidden provenance and deterministic ordering are explicit. Invalid required-category sets return typed validation issues.
  - **Validation:** Known array fixtures for inherited/overridden/added/hidden/restored keys, immutable IDs, tied positions, missing categories and sibling isolation; standard gate.
  - **Commit:** `feat: resolve scoped statuses by stable key`.

- [ ] **P04-02 — Status configuration and list resolution endpoints**
  - **Goal:** Expose typed status CRUD and the authoritative resolved-list status endpoint.
  - **Files:** `apps/api/src/statuses/**`, `apps/api/test/statuses.e2e-spec.ts`, generated artifacts.
  - **Dependencies:** P04-01.
  - **Acceptance:** Scoped config endpoints and `GET /v1/lists/:id/resolved-statuses` use the same pure resolver. Admin-only config, readable resolved sets follow list access. Stable identities and local overrides serialize distinctly. Basic in-use/descendant safety ships with these writes; P04-03 expands its regression coverage. Mutations increment configVersion and reads return it from the same snapshot as their items.
  - **Validation:** Two sibling lists under one folder return different expected sets; override retains task statusId; illegal category edits, invalid owner, forbidden scope and invalid sets reject. Endpoint DoD and standard gate.
  - **Commit:** `feat: expose scoped status configuration`.

- [ ] **P04-03 — Safe status mutation across descendants**
  - **Goal:** Prevent orphaned tasks when ancestor configuration changes.
  - **Files:** `apps/api/src/statuses/status-safety.service.ts`, status service/repositories, `apps/api/test/status-safety.e2e-spec.ts`.
  - **Dependencies:** P04-02.
  - **Acceptance:** Proposed mutations validate owning scope and all affected active descendant lists under one lock. Hide/delete rejects in-use effective statuses. Physical identity deletion respects archived references. Removing overrides re-evaluates fallback.
  - **Validation:** Parent hide with child task, hiding last active/done, safe unused deletion, child overrides unaffected where appropriate, rollback leaves all lists valid; endpoint DoD and standard gate.
  - **Commit:** `fix: prevent orphaned status references`.

## Phase 5 — Custom fields

- [ ] **P05-01 — Pure field resolution and value validation**
  - **Goal:** Share exact field precedence/types across server and forms.
  - **Files:** `packages/contracts/src/{fields,field-resolution,field-values}.ts`, `packages/contracts/test/field-values.test.ts`.
  - **Dependencies:** P04-03.
  - **Acceptance:** Nearest full definition wins. All six field types, strict calendar dates, finite numbers, unique option IDs, required semantics and path-based errors are specified; null clear and omitted value differ.
  - **Validation:** Wrong types, unknown/duplicate options/keys, blank required text, missing required, invalid dates, zero/false accepted, nearest collision changes entire schema; standard gate.
  - **Commit:** `feat: resolve and validate custom fields`.

- [ ] **P05-02 — Custom-field configuration and resolved schemas**
  - **Goal:** Add scoped field CRUD and authoritative list schemas.
  - **Files:** `apps/api/src/fields/**`, `apps/api/test/fields.e2e-spec.ts`, generated artifacts.
  - **Dependencies:** P05-01.
  - **Acceptance:** Space/folder/list owners only, admin-only mutations, typed options and provenance, `GET /v1/lists/:id/resolved-fields`. Uses shared resolver and tenant repositories. In-use/descendant validation ships with the first write routes; P05-03 hardens edge coverage. Mutations increment configVersion and resolved reads return a consistent version.
  - **Validation:** Owner mismatch, field-key collision, sibling independence, member writes 403, foreign fields 404 and schema response shape; endpoint DoD and standard gate.
  - **Commit:** `feat: expose scoped custom field schemas`.

- [ ] **P05-03 — Reject destructive field-schema changes**
  - **Goal:** Keep stored task values valid after ancestor/local configuration changes.
  - **Files:** `apps/api/src/fields/field-safety.service.ts`, field service/repositories, `apps/api/test/field-safety.e2e-spec.ts`.
  - **Dependencies:** P05-02.
  - **Acceptance:** Validate affected live tasks transactionally. Block deletion of in-use effective definition, invalid option removal, incompatible type changes, required promotion with missing values, and invalid fallback exposed by deleting override. Document optional→populate→required workflow.
  - **Validation:** Each rejected mutation returns field paths and preserves definitions/tasks; zero/false do not falsely block required promotion; safe unused deletion succeeds. Endpoint DoD and standard gate.
  - **Commit:** `fix: preserve task validity during field changes`.

## Phase 6 — Tasks and atomic moves

- [ ] **P06-01 — Task reads, cursor pagination and filters**
  - **Goal:** Load board/list/drawer data without leaks or unstable pagination.
  - **Files:** `packages/contracts/src/tasks.ts`, `apps/api/src/tasks/{tasks.module,tasks.controller,task-query.service,tasks.dto}.ts`, `apps/api/test/task-queries.e2e-spec.ts`, generated artifacts.
  - **Dependencies:** P05-03.
  - **Acceptance:** List task pages/detail include requested built-ins and customFields, never secrets. Due/priority sorting, stable null ordering and one typed custom-field filter work. Cursor binds resource/filter/sort and limit is bounded. Task pages include configVersion from the same transaction snapshot.
  - **Validation:** No duplicate/skipped ties on stable dataset, malformed/mismatched cursor 400, hidden/foreign task access, null dates and all priorities, option filter types; endpoint DoD and standard gate.
  - **Commit:** `feat: query paginated tasks with typed filters`.

- [ ] **P06-02 — Validated task create, edit and archive**
  - **Goal:** Persist complete valid tasks and durable event intent.
  - **Files:** `apps/api/src/tasks/task-write.service.ts`, `packages/contracts/src/events.ts`, task controllers/repositories, `apps/api/test/task-writes.e2e-spec.ts`, generated artifacts.
  - **Dependencies:** P06-01.
  - **Acceptance:** Validate title ≤500, Markdown string, dates, destination status, members/assignee access and effective custom fields. PATCH omission/clear semantics and expected versions work. Task update and outbox insert commit together. Archive removes task from normal reads.
  - **Validation:** Unknown statusId 400; foreign/disallowed assignee; title 501; wrong type/option/missing required; explicit clear; stale edit 409; rollback emits no event. Endpoint DoD and standard gate.
  - **Commit:** `feat: write tasks with scoped validation`.

- [ ] **P06-03 — Cross-list moves and column ordering**
  - **Goal:** Move cards atomically while preserving valid status, fields and ordering.
  - **Files:** `apps/api/src/tasks/task-move.service.ts`, task contracts/controller, `apps/api/test/task-moves.e2e-spec.ts`, generated artifacts.
  - **Dependencies:** P06-02.
  - **Acceptance:** Source/destination permissions checked; preserve status or map first same category; missing category rejects. Move accepts required field values/explicit clears. Reorder validates neighbor list+column and versions; one transaction updates everything/outbox.
  - **Validation:** Same-category mapping success; closed→no closed rejects; required destination field missing rejects/provided succeeds; source-only value needs explicit clear; wrong anchors/tenant reject; concurrent config/move remains valid; failure leaves task unchanged. Endpoint DoD and standard gate.
  - **Commit:** `feat: move and reorder tasks atomically`.

- [ ] **P06-04 — Complete task invariants and contract regression**
  - **Goal:** Audit all task entry points against the required negative scenarios.
  - **Files:** `apps/api/test/{tenant-isolation,task-invariants}.e2e-spec.ts`, `packages/contracts/test/task-patches.test.ts`, necessary task/repository fixes, generated artifacts.
  - **Dependencies:** P06-03.
  - **Acceptance:** REST tests cover tenant reads/writes/relationships, denied list, parent configuration changes, status deletion and field safety with actual task APIs. No orphaned active cards; all response bodies satisfy contracts.
  - **Validation:** Full real-Postgres suite with two tenants; standard gate. Fix actual defects rather than weaken expectations.
  - **Commit:** `test: cover task isolation and mutation invariants`.

- [ ] **P06-05 — Validated container reparenting**
  - **Goal:** Complete container moves now that status and field rules are available.
  - **Files:** `apps/api/src/hierarchy/node-move.service.ts`, node contracts/controller, `apps/api/test/node-moves.e2e-spec.ts`, generated artifacts.
  - **Dependencies:** P06-04.
  - **Acceptance:** Admin can move folder/list only to a valid same-tenant parent. Revalidate resulting subtree permissions, status availability and all live task field schemas; reject invalid reparenting rather than silently remap a whole subtree. Update versions/events as needed.
  - **Validation:** Cycle, archived parent, cross-tenant target, required-field/status mismatch, valid move and atomic rollback across descendants; endpoint DoD and standard gate.
  - **Commit:** `feat: reparent containers with invariant checks`.

## Phase 7 — Complete API tooling and generated transport

- [ ] **P07-01 — Full OpenAPI lint and deterministic drift checks**
  - **Goal:** Make API contracts independently verifiable without running infrastructure.
  - **Files:** `packages/openapi/{scripts/check.ts,scripts/lint.ts,.spectral.yaml,test/**}`, `packages/openapi/openapi.json`, API spec bootstrap, Turbo/manifests.
  - **Dependencies:** P06-05.
  - **Acceptance:** `pnpm openapi:check` regenerates to a temporary file and fails on drift. Spectral checks domain `/v1`, documented infrastructure exceptions, unique operationIds, typed error responses and cursor collection endpoints. All real controllers are exported without runtime clients connecting.
  - **Validation:** Remove an operationId/change a DTO/miss a page wrapper and assert check failure; restore and pass; no DB/Redis/network needed; standard gate.
  - **Commit:** `chore: enforce openapi conventions and drift checks`.

- [ ] **P07-02 — Client generation exports and reproducibility**
  - **Goal:** Stabilize the generated SDK/TanStack package and check clean builds.
  - **Files:** `packages/api-client/{openapi-ts.config.ts,src/index.ts,src/generated/**,scripts/check.ts,test/generation.test.ts}`, package exports/Turbo tasks.
  - **Dependencies:** P07-01.
  - **Acceptance:** SDK/types/queryKeys/queryOptions/mutationOptions exported from package subpaths; generated code isolated. `pnpm gen:api` syncs committed artifacts; `pnpm client:check` compares temporary regeneration. Normal builds emit ignored files and never mutate committed sources.
  - **Validation:** Frozen clean install/build without DB/Redis; temporary output equals committed; intentionally changed generated file fails check; standard gate.
  - **Commit:** `chore: finalize generated api client workflow`.

- [ ] **P07-03 — Configured client with refresh and retry-once**
  - **Goal:** Give web one safe transport integration without handwritten endpoints.
  - **Files:** `packages/api-client/src/{setup-client,session-state}.ts`, `packages/api-client/test/setup-client.test.ts`, auth contract/client tests.
  - **Dependencies:** P07-02.
  - **Acceptance:** `setupClient` configures an instance with base URL/credentials/token lookup, coordinates refresh and retries each rejected request once. Uses generated refresh SDK through an unwrapped instance; guards recursion and preserves abort. No retry for arbitrary network failure or forbidden 403. Defines origin-scoped tab lock and failure reauth behavior.
  - **Validation:** Concurrent 401s trigger one refresh; refresh failure/replayed token stops; 403 never refreshes; mutation retried at most once only after 401; aborted request stays aborted; instance state never shared across SSR requests; standard gate.
  - **Commit:** `feat: configure generated client session refresh`.

## Phase 8 — UI package and application shell

- [ ] **P08-01 — MUI theme and presentational display components**
  - **Goal:** Establish the reusable visual system before feature UI.
  - **Files:** `packages/ui/src/{theme,theme-provider,index}.tsx`, `packages/ui/src/components/{status-chip,priority-badge,assignee-avatar-group,due-date-label,custom-field-chip,empty-state,error-state}.tsx`, `packages/ui/test/**`, `apps/web/app/playground/page.tsx`.
  - **Dependencies:** P07-03.
  - **Acceptance:** App Router Emotion cache, semantic theme tokens, all status/priority/empty/error examples, light/dark token definitions and local playground. Props only; no API imports.
  - **Validation:** RTL accessible labels/color-independent state, long content, SSR hydration smoke and responsive playground screenshots; standard gate.
  - **Commit:** `feat: build shared mui display components`.

- [ ] **P08-02 — Typed forms and interaction primitives**
  - **Goal:** Build dynamic fields, confirmation, tree and card/column presentation used by views.
  - **Files:** `packages/ui/src/components/{custom-field-input,form-field,confirm-dialog,tree-item,kanban-column,kanban-card}.tsx`, `packages/ui/test/inputs.test.tsx`, playground stories.
  - **Dependencies:** P08-01.
  - **Acceptance:** All six custom-field inputs, explicit null/blank mapping, accessible labels/errors, focus trap/return and composable controlled props. React Hook Form adapters use shared schemas without copying types. Components contain no fetching.
  - **Validation:** Zero/false, empty date/number, select ID, dynamic option removal, keyboard tree/confirm and stable field-array identity; standard gate.
  - **Commit:** `feat: add shared form and board primitives`.

- [ ] **P08-03 — Auth pages, providers and visible sidebar**
  - **Goal:** Connect generated transport to an authenticated app shell.
  - **Files:** `apps/web/app/{layout,(auth)/**,(workspace)/**}`, `apps/web/src/{providers,features/auth/**,features/tree/**,lib/query-scope.ts}`, web component tests.
  - **Dependencies:** P08-02.
  - **Acceptance:** Signup/login/refresh bootstrap/logout/workspace switch, one browser QueryClient, accessible collapsible paginated tree, list selection in URL. Loading/error/empty/forbidden states. Clear caches and sockets when identity changes; no prior-tenant flash.
  - **Validation:** Login errors, refresh expiry, logout then Bob after Alice, private list hidden, tree loading all pages, browser-back selection and mobile sidebar; standard gate.
  - **Commit:** `feat: add authenticated workspace shell`.

## Phase 9 — Board, list and drawer

- [ ] **P09-01 — Resolved Kanban board**
  - **Goal:** Render each list from its authoritative statuses and tasks.
  - **Files:** `apps/web/src/features/board/{board,board-data,use-board}.tsx`, board tests, board route.
  - **Dependencies:** P08-03.
  - **Acceptance:** Parallel generated queries load statuses/fields/tasks; render only matching configVersions and refetch mismatches with bounded retries. Exact columns including empty ones, requested card metadata and pagination. No orphan fallback column. List change isolates cached data and reports schema errors.
  - **Validation:** Sibling lists produce different exact columns; config changes between parallel responses cause safe refetch rather than orphan cards. Cover empty board, long title, deleted/forbidden list, field chip and loading/error state; standard gate.
  - **Commit:** `feat: render list scoped kanban boards`.

- [ ] **P09-02 — Optimistic drag and accessible move controls**
  - **Goal:** Move/reorder cards with rollback and concurrent-state safety.
  - **Files:** `apps/web/src/features/board/{board-dnd,use-task-mutation,move-menu}.tsx`, `apps/web/src/features/board/task-mutation.test.tsx`.
  - **Dependencies:** P09-01.
  - **Acceptance:** dnd-kit pointer/keyboard support plus button alternatives; generated mutations; per-task in-flight serialization; snapshots/rollback and targeted refetch. Cross-list move can collect missing required fields. Errors and stale-version conflicts are visible.
  - **Validation:** Cross-column and intra-column ordering, rejected move restores, list switch during save, fast repeated moves, 403/409, keyboard announcement/focus, 320px controls; standard gate.
  - **Commit:** `feat: add optimistic accessible card moves`.

- [ ] **P09-03 — Sortable list view with custom columns**
  - **Goal:** Offer a second view of the same scoped tasks and filters.
  - **Files:** `apps/web/src/features/list/{task-table,list-toolbar,use-list-query}.tsx`, list tests, view route/search-param schema.
  - **Dependencies:** P09-02.
  - **Acceptance:** Title/status/assignees/priority/due date plus at least two effective custom columns; server due/priority sort, typed field filter, cursor pages, URL state and responsive overflow.
  - **Validation:** Priority order/null dates, custom select filter, reset cursor on sort/filter/list change, inherited column labels and unknown URL values; standard gate.
  - **Commit:** `feat: add task table sorting and field filters`.

- [ ] **P09-04 — Task drawer and early browser acceptance path**
  - **Goal:** Edit task built-ins/custom fields through the same shared contracts.
  - **Files:** `apps/web/src/features/tasks/{task-drawer,task-form,task-create}.tsx`, drawer tests, `apps/web/playwright.config.ts`, `apps/web/e2e/task-edit.spec.ts`.
  - **Dependencies:** P09-03.
  - **Acceptance:** Create/edit/archive, resolved dynamic inputs, safe Markdown, field-specific API errors, dirty-edit preservation, save resets defaults and closing prompts appropriately. Implement the required login→list→columns→drawer→field-save flow now. Activity UI waits for P11-02.
  - **Validation:** All input types, required/option errors, failed save preserves values, malicious raw HTML not executed, focus return; Playwright save persists after reload; standard gate includes browser path.
  - **Commit:** `feat: edit tasks in a validated detail drawer`.

## Phase 10 — Configuration UI

- [ ] **P10-01 — Scoped status editor and preview**
  - **Goal:** Make inheritance, overrides and safety errors understandable to admins.
  - **Files:** `apps/web/src/features/config/statuses/**`, config routes, status editor tests, playground examples.
  - **Dependencies:** P09-04.
  - **Acceptance:** Space/folder/list editors show inherited/local/hidden states; change label/color/order, add/hide/unhide/remove override; preview uses shared resolver. Authoritative save uses generated API and refreshes descendant views.
  - **Validation:** Last-category/in-use rejection, stable ID on rename, sibling isolation, member read-only behavior, focus/keyboard and field-error mapping; standard gate.
  - **Commit:** `feat: manage inherited status configuration`.

- [ ] **P10-02 — Scoped custom-field editor and preview**
  - **Goal:** Configure all six field types without hiding downstream consequences.
  - **Files:** `apps/web/src/features/config/fields/**`, field editor tests and examples.
  - **Dependencies:** P10-01.
  - **Acceptance:** Space/folder/list field CRUD, local/inherited nearest-key preview, options with stable IDs and required-state guidance. Failed in-use/type/required mutation preserves editor values.
  - **Validation:** Dynamic option identity on reorder/remove, duplicate keys/options, required promotion rejection, inherited override removal, field-path errors and role restrictions; standard gate.
  - **Commit:** `feat: manage inherited custom field configuration`.

## Phase 11 — Durable activity and realtime

- [ ] **P11-01 — Durable outbox dispatch to BullMQ**
  - **Goal:** Deliver persisted task events after commit, surviving Redis outages.
  - **Files:** `apps/api/src/outbox/**`, `packages/contracts/src/{events,jobs}.ts`, `apps/api/test/outbox.integration.test.ts`, Redis test harness/config.
  - **Dependencies:** P10-02.
  - **Acceptance:** Claim/retry durable events; stable event ID/job ID; bounded backoff and observable failures. No lost intent after DB commit, no event from rolled-back write, multiple dispatchers safely claim work.
  - **Validation:** Redis unavailable then recovers, dispatcher crash/retry, duplicate attempts, two dispatchers, malformed job schema; standard gate with real Redis/Postgres.
  - **Commit:** `feat: dispatch durable task events to bullmq`.

- [ ] **P11-02 — Idempotent activity worker and drawer feed**
  - **Goal:** Turn status-change events into stored, visible activity.
  - **Files:** `apps/worker/src/{main,activity.processor,health,search-index.stub}.ts`, `apps/worker/test/activity.integration.test.ts`, `apps/api/src/activity/**`, `apps/web/src/features/tasks/activity-feed.tsx`, generated artifacts.
  - **Dependencies:** P11-01.
  - **Acceptance:** Worker verifies each job against its persisted outbox record, derives tenant context, and inserts one Activity per event. Paginated authorized activity endpoint and drawer feed show actor/time/from/to. Publication retries even if Activity already exists; mark delivery complete only after successful publish. Graceful worker shutdown/heartbeat. Search stub is explicit `TODO(NEXT-01)` and does not advertise indexing.
  - **Validation:** Duplicate/retried delivery yields one activity; crash after Activity insert but before publish recovers the notification; malformed/cross-tenant payload blocked; forbidden task feed 403; empty/loading/error feed states; endpoint DoD and standard gate.
  - **Commit:** `feat: persist and display task activity`.

- [ ] **P11-03 — Permission-safe Socket.IO collaboration**
  - **Goal:** Update other clients while preserving tenant and resource access.
  - **Files:** `apps/api/src/realtime/**`, `apps/api/test/realtime.integration.test.ts`, `apps/web/src/features/realtime/**`, realtime browser tests.
  - **Dependencies:** P11-02.
  - **Acceptance:** Redis adapter, verified JWT handshake, guarded list subscriptions and safe source/destination invalidations. Revoke rooms on access changes, disconnect at token expiry, refetch on reconnect. Dirty forms preserve local edits and report conflicts; duplicate/stale events ignored.
  - **Validation:** Two clients update; two API instances fan out; Bob cannot subscribe to private list; foreign room blocked; grant revocation stops next event; move does not reveal hidden target; reconnect catches missed changes. Standard gate.
  - **Commit:** `feat: synchronize authorized clients in realtime`.

## Phase 12 — Release verification and documentation

- [ ] **P12-01 — End-to-end role and collaboration regression**
  - **Goal:** Consolidate browser release checks without postponing earlier feature tests.
  - **Files:** `apps/web/e2e/{task-edit,permissions,realtime,config}.spec.ts`, `compose.test.yaml`, CI test orchestration, any discovered focused fixes.
  - **Dependencies:** P11-03.
  - **Acceptance:** Required edit path, Alice→Bob private-list disappearance, exact sibling columns, rollback, configuration save and two-client realtime pass using real services. Fresh fixtures and independent sessions prevent leaked auth/state.
  - **Validation:** Headless Chromium full suite; keyboard path, axe checks, responsive/reduced-motion smoke; root test demonstrably runs API+UI+worker+E2E; standard gate.
  - **Commit:** `test: verify flowboard user journeys end to end`.

- [ ] **P12-02 — Operational docs and second-channel cookbook**
  - **Goal:** Make the app understandable and usable without its web UI.
  - **Files:** `README.md`, `scripts/curl-cookbook.md`, `docs/api-events.md`, `docs/DECISIONS.md`, `docs/system-design.docx` refreshed only for design changes.
  - **Dependencies:** P12-01.
  - **Acceptance:** README covers every requested section: run/ports/users, Mermaid architecture plus load-board/drag flow, model, exact resolution rules, archive policy, auth/OIDC, permission/team evolution, scalability/indexes, splits/tradeoffs and tests in Docker. Cookbook logs in with cookie jar, refreshes, loads/edits/moves a task and handles errors. Event examples are schema-valid and clearly not a deployed webhook service.
  - **Validation:** Execute cookbook against demo services, schema-check event examples, verify links/commands/credentials and no real tokens committed; standard gate.
  - **Commit:** `docs: explain operations and shared api contracts`.

- [ ] **P12-03 — Clean-checkout release gate and polish**
  - **Goal:** Prove a new developer can build/run/test without undocumented setup.
  - **Files:** `.github/workflows/ci.yml`, `scripts/check-release.mjs`, Compose/Docker files if fixes needed, focused UI/API fixes, README and task evidence.
  - **Dependencies:** P12-02.
  - **Acceptance:** CI pins toolchain; clean frozen install/build/lint/test, OpenAPI/client checks and one-command Compose boot succeed. Restart keeps edits; test volumes isolate data; dependency outage/readiness/recovery visible. No untracked placeholder remains; deferred search is documented.
  - **Validation:** Clean disposable checkout + volumes, all five healthy, full required suites, reproducible artifacts and final diff/security/accessibility review. Update completion evidence; do not reset user data.
  - **Commit:** `chore: verify clean checkout release workflow`.

## Explicitly deferred work

- [ ] **NEXT-01 — Replace the declared search-index stub when search is requested**
  - **Goal:** Supply real indexing/query behavior only after product scope includes search.
  - **Files:** `apps/worker/src/search-index.stub.ts` replacement, future search contracts/API/UI/tests.
  - **Dependencies:** P12-03 and an explicit search request/design.
  - **Acceptance:** Search backend, access filtering, update/delete/reindex semantics and failure recovery are designed and tested; remove stub TODO only when real behavior exists.
  - **Validation:** Defined with the future design; this is intentionally not part of MVP completion.
  - **Commit:** Chosen when the task is authorized.

Other future capabilities (OIDC integration, teams, webhook delivery, restore, billing, uploads) are design notes, not disguised incomplete MVP implementations. Add tasks only if those features are requested.
