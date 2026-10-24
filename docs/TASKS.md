# Flowboard Task Backlog

Status: Phase 0 foundation implementation authorized and in progress. Execute top to bottom, one task at a time. Dependencies name the technical prerequisites; they do not authorize skipping ahead. Paths below are planned deliverables; check their current implementation and evidence. Small supporting edits are allowed only within the task's stated goal and must be recorded in its completion note.

Canonical behavior is in [PLAN.md](PLAN.md), the brief in [REQUIREMENTS.md](REQUIREMENTS.md), and defaults in [DECISIONS.md](DECISIONS.md). Read [AGENTS.md](../AGENTS.md) before execution.

## Definition of done for every task

- [ ] Write the next behavioral test at the named public seam and observe its expected failure; implement one passing slice at a time. Documentation/config-only tasks use relevant structural checks instead.
- [ ] Run `pnpm build`, `pnpm lint`, `pnpm test`; fix all failures. Before the scaffold creates these scripts, record the exact available bootstrap checks rather than claim these commands passed.
- [ ] For every endpoint: shared schema with titles/descriptions/examples → Zod DTO → typed controller response and explicit operationId/summary/description → guard metadata → spec regenerated → client regenerated → at least one behavioral test. Verify concrete response schemas and schema-valid examples. Never defer contract artifacts to a later phase.
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

- [x] **P00-16 — Local Graphify navigation with untracked data**
  - **Goal:** Help Codex and contributors navigate real code relationships without publishing generated graph data.
  - **Requirements:** R100; complements H06.
  - **Files:** `.graphifyignore`, `.gitignore`, `.dockerignore`, `.prettierignore`, `AGENTS.md`, `README.md`, `docs/{GRAPHIFY,DECISIONS,TASKS,REQUIREMENTS_MATRIX}.md`, `packages/config-typescript/test/workspace.test.mjs`, `docs/evidence/P00-16.md`.
  - **Dependencies:** P00-15; reuse the installed Graphify CLI without changing global settings.
  - **Acceptance:** Local code-only generation produces a nonempty graph/report and supports a bounded query. Generated outputs, caches and temporary Graphify files are ignored at any workspace depth; authored config/docs remain trackable. Dependencies, build outputs and secrets are excluded from extraction. Codex guidance treats the graph as optional navigation and verifies claims against current source. No runtime dependency, cloud extraction, global hook or generated graph is committed.
  - **Validation:** Ignore-rule regression, native detection/extraction and bounded query, second cached update, tracked-file audit, standard gates and applicable Docker checks.
  - **Commit:** `chore: add local graphify navigation`.
  - **Completion evidence:** [P00-16 verification](evidence/P00-16.md): local graph/query/cache and ignore checks pass; 124 tests and five-service Docker acceptance pass. Generated data remains untracked.

- [x] **P00-17 — Focused local tools for AI-assisted coding**
  - **Goal:** Add syntax-aware search and local secret checks, and make existing Serena navigation easy to use alongside Graphify.
  - **Requirements:** R101; preserves R100.
  - **Files:** root `package.json`, `pnpm-lock.yaml`, targeted pnpm install policy if required, `.gitleaks.toml`, local-data ignores, `AGENTS.md`, `README.md`, `docs/{AI_TOOLS,DECISIONS,TASKS,REQUIREMENTS_MATRIX}.md`, workspace tests and task evidence.
  - **Dependencies:** P00-16.
  - **Acceptance:** Pinned ast-grep performs structural searches without editing source; existing Gitleaks scans locally with built-in rules and redacted reports; a synthetic secret is detected. Serena guidance uses the existing connector without global changes. Local reports/state stay ignored and no runtime dependency, paid service or automatic hook is introduced.
  - **Validation:** Behavioral syntax-search fixture, synthetic secret/redaction and clean-repo scans, ignored-report regression, Serena symbol lookup, standard gates and relevant packaging checks.
  - **Commit:** `chore: add focused local coding tools`.
  - **Completion evidence:** [P00-17 verification](evidence/P00-17.md): structural-search/secret-scan checks, 126 tests and Docker pass; fresh Serena indexing works, existing connector needs reconnect. Local state remains untracked.

- [x] **P00-18 — Add local Reverse Engineer Anything tooling**
  - **Goal:** Inspect shipped JavaScript artifacts with the official REA CLI alongside the existing source-navigation tools.
  - **Requirements:** R102; preserves R100–R101.
  - **Files:** `docs/{REA,AI_TOOLS,DECISIONS,TASKS,REQUIREMENTS_MATRIX}.md`, `AGENTS.md`, `README.md`, workspace ignore regression and `docs/evidence/P00-18.md`; installation and output under ignored `.ai-local/rea/` only.
  - **Dependencies:** P00-17 and the user's explicit REA request.
  - **Acceptance:** Version-pinned official CLI installs locally without global agent setup, install hooks or optional native instrumentation. Static analysis of our built JavaScript produces inspectable evidence; an invalid target fails. Tool dependencies, cache and reports remain ignored, excluded from Docker/Graphify and outside normal workspace dependencies. Document CLI usage, summary views and the separate status of MCP registration/native engines.
  - **Validation:** Actual CLI version, owned-artifact analysis and missing-target checks; local-data exclusion regression and tracked-file audit; G01/G03/G04/G05 build/lint/test/type/format checks. No API or runtime image changes.
  - **Commit:** `chore: add local reverse engineering tools`.
  - **Completion evidence:** [P00-18 verification](evidence/P00-18.md): pinned CLI, static artifact/non-execution/error checks, 126 tests and all workspace gates pass. Installation and generated data remain local; MCP is not registered.

- [x] **P00-19 — Research comparable products and detail Flowboard's system design**
  - **Goal:** Turn published ClickUp/Asana/Linear patterns into a concrete UI, backend, database and request-flow design for the existing requirements.
  - **Requirements:** R103; clarifies H01–H03 and planned R28–R89 without claiming those features work.
  - **Files:** `docs/{REFERENCE_ARCHITECTURES,SYSTEM_DESIGN,PLAN,DECISIONS,TASKS,REQUIREMENTS_MATRIX}.md`, `ARCHITECTURE.md`, `AGENTS.md`, `README.md`, `docs/evidence/P00-19.md`.
  - **Dependencies:** Existing architecture/requirements and P00-18; the user's research/design request takes priority over the deferred live-host task.
  - **Acceptance:** Primary sources have dates and distinguish published internals, public behavior and Flowboard proposals. Design includes UI/state ownership, modular backend, tenant-aware ERD/constraints/indexes, inheritance examples, reads/writes/auth/events/failure flows and implementation-task mapping. Correct cross-site refresh-cookie topology in the plan and track its implementation separately. Preserve the fixed stack, scope, permissions and atomicity rules.
  - **Validation:** Source/claim review, document links, Mermaid syntax, requirement/task consistency, formatting and independent design review. Documentation only; no runtime or migration claims.
  - **Commit:** `docs: detail Flowboard system architecture`.
  - **Completion evidence:** [P00-19 verification](evidence/P00-19.md): primary-source/architecture reviews, 10 parsed diagrams, document/requirement checks and all workspace gates pass. Domain and proxy implementation remain future tasks.

- [x] **P00-20 — Enforce conventional commits locally and in CI**
  - **Goal:** Reject malformed commit messages and PR titles with the same conventional-commit policy.
  - **Requirements:** R104; preserves parallel CI and existing task commit rules.
  - **Files:** `.githooks/commit-msg`, `commitlint.config.mjs`, root/Turbo/config-eslint manifests, config-eslint scripts/tests, delivery workflow/regression tests, `docs/{CODE_QUALITY,DECISIONS,TASKS,REQUIREMENTS_MATRIX}.md`, README and task evidence.
  - **Dependencies:** P00-19 and the user's commitlint request.
  - **Acceptance:** Pinned commitlint accepts conventional and breaking-change messages and rejects invalid ones. An explicitly installed repository-local hook handles spaced paths without overwriting another hook configuration. CI checks actual PR commits and title via event data, including edited titles, without shell interpolation or new paid runners. Root commands delegate to uncached Turbo tasks; failures block publication.
  - **Validation:** Positive/negative message and metadata fixtures, Git range/zero-SHA errors, local hook/install behavior, workflow regression, actionlint, build/lint/test/type/format and relevant Docker checks.
  - **Commit:** `chore: enforce conventional commit messages`.
  - **Completion evidence:** [P00-20 verification](evidence/P00-20.md): 16 focused cases, 143 repository tests, standard gates and Docker acceptance pass; local hook enabled.

- [x] **P00-21 — Strengthen shared linting and deterministic ordering**
  - **Goal:** Apply compatible quality, naming, unused-code and safe sorting rules across backend, frontend and authored JSON.
  - **Requirements:** R105; preserves R93 and application behavior.
  - **Files:** config-eslint dependencies/config/tests, root lint coverage, package JSON/config and authored source fixes, lockfile, `docs/{CODE_QUALITY,DECISIONS,TASKS,REQUIREMENTS_MATRIX}.md`, task evidence.
  - **Dependencies:** P00-20.
  - **Acceptance:** Add Perfectionist, SonarJS, unused-import and JSON rules without duplicating Next/React, import-x or Prettier. Automate PascalCase for types/classes and JSX references; document component declarations as a review convention. Runtime names and external JSON contracts retain appropriate case. Sort safe named imports, types, literal props/objects and JSON keys; preserve destructuring evaluation, dependency defaults, overloads, spreads, side-effect imports and conditional export semantics. Fix genuine diagnostics without blanket disabling checks or changing generated code.
  - **Validation:** Positive/negative JS/TS/TSX/JSON fixtures and semantic ordering regressions; full build/lint/test/type/format, frozen install and Docker checks.
  - **Commit:** `chore: strengthen shared eslint quality rules`.
  - **Completion evidence:** [P00-21 verification](evidence/P00-21.md): 12 rule/safety fixtures, 155 repository tests, standard gates and Docker acceptance pass; reviewed sorting and naming limits documented.

- [x] **P00-22 — Preserve package manifests and enforce exact dependency versions**
  - **Goal:** Keep `package.json` key order unchanged while rejecting unpinned dependency specifications through shared ESLint.
  - **Requirements:** R106; preserves R105 JSON syntax checks and the workspace dependency convention.
  - **Files:** `packages/config-eslint/src/{json,exact-dependency-versions}.mjs`, config-eslint tests/manifest, lockfile if needed, `docs/{CODE_QUALITY,DECISIONS,TASKS,REQUIREMENTS_MATRIX}.md`, task evidence.
  - **Dependencies:** P00-21 and the user's manifest-policy correction.
  - **Acceptance:** No sorting diagnostics or sorting fixes anywhere in `package.json`; other JSON still sorts and strict JSON syntax/duplicate-key checks remain active. Runtime/dev/optional/peer dependency declarations accept exact semantic versions and `workspace:*`; reject ranges, tags and unpinned sources without guessing replacement versions. Engine compatibility ranges remain allowed.
  - **Validation:** Actual ESLint manifest fixtures for preserved order, exact/prerelease/build versions, rejected ranges/tags/sources and non-dependency fields; root/workspace integration, build/lint/test/type/format and frozen install if dependencies change.
  - **Commit:** `chore: enforce pinned manifest dependencies`.
  - **Completion evidence:** [P00-22 verification](evidence/P00-22.md): seven manifest regression tests, 162 repository tests and standard gates pass; package sorting disabled and exact versions enforced without autofix.

- [x] **P00-23 — Organize package manifests for maintainers**
  - **Goal:** Replace the earlier alphabetical layout with consistent semantic grouping across the root and all workspace manifests.
  - **Requirements:** R107; preserves R106 exact versions and disabled manifest sorting.
  - **Files:** root `package.json`, `apps/*/package.json`, `packages/*/package.json`, `docs/{CODE_QUALITY,DECISIONS,TASKS,REQUIREMENTS_MATRIX}.md`, task evidence.
  - **Dependencies:** P00-22 and the user's manifest-layout request.
  - **Acceptance:** Identity and module/toolchain metadata come first, then exports/files, lifecycle and verification scripts, dependencies and formatter settings. Group scripts by purpose. Preserve every existing field/value, dependency order, export condition order and arrays. Do not add an automatic ordering rule or change versions, commands or publishing behavior.
  - **Validation:** Check all 14 manifests against their pre-change data and ordered export trees; existing workspace/build/lint/test/type/format gates and frozen install. No new style-only unit test.
  - **Commit:** `chore: organize package manifests by purpose`.
  - **Completion evidence:** [P00-23 verification](evidence/P00-23.md): all 14 manifests retain identical data and nested order; 162 tests and standard gates pass.

- [x] **P00-24 — Specify the backend database and ER model**
  - **Goal:** Turn the agreed logical model into a migration-ready data dictionary and integrity specification.
  - **Requirements:** R108; refines R28–R61 and R74–R75 without claiming implementation.
  - **Files:** `docs/DATABASE_DESIGN.md`, architecture/plan links, decisions, requirement matrix, this backlog and evidence.
  - **Dependencies:** P00-23 and the user's documentation-first request.
  - **Acceptance:** All 15 records, ER relationships, types/nullability/defaults, tenant keys, constraints, indexes, archive policy, transaction boundaries and migration tests are explicit. Clarify refresh families, inherited visibility and versions after renumbering. No Prisma schema/migration or runtime endpoint is added.
  - **Validation:** Independent database review, Mermaid parsing, source/link consistency and formatting; preserve domain requirements as Planned.
  - **Commit:** `docs: specify backend database and er model`.
  - **Completion evidence:** [P00-24 verification](evidence/P00-24.md): 15-record design reviewed, diagrams parsed and links checked; no runtime implementation claim.

- [x] **P00-25 — Specify the REST API catalog and contracts**
  - **Goal:** Give backend and frontend implementation a shared endpoint-by-endpoint contract.
  - **Requirements:** R109; refines existing API/auth/domain requirements.
  - **Files:** `docs/API_CATALOG.md`, architecture/plan links, decisions, task acceptance refinements and evidence.
  - **Dependencies:** P00-24.
  - **Acceptance:** Every planned operation has method/path, stable operationId, access policy, typed input/output, error and implementation task. Define pagination, concurrency, configuration previews, refresh cookies and example task/config commands. No generated spec or runtime route is represented as implemented.
  - **Validation:** Unique route/operationId inventory, consistency with DB/requirements, JSON examples, independent API review and formatting.
  - **Commit:** `docs: define rest api implementation catalog`.
  - **Completion evidence:** [P00-25 verification](evidence/P00-25.md): 43 unique operations, schema examples and cross-document contract review pass; endpoints remain planned.

- [x] **P00-26 — Analyze Linear interactions and map the MUI UI**
  - **Goal:** Convert observable Linear patterns into a scoped, accessible Flowboard UI implementation guide.
  - **Requirements:** R110; refines R62–R76.
  - **Files:** `docs/UI_DESIGN.md`, public-source references, architecture/plan links, component/task mapping and evidence.
  - **Dependencies:** P00-25.
  - **Acceptance:** Dated official sources distinguish observation from proposed design; specify shell, board/table, drawer, configuration, MUI components/tokens, responsive states, generated-query boundaries, accessibility and ordered acceptance tests. Preserve Flowboard hierarchy/multiple assignees and fixed stack. No private Linear internals or shipped UI is claimed.
  - **Validation:** Primary-source review, requirement/component/API traceability, Mermaid/link/format checks and independent UI review.
  - **Commit:** `docs: map linear interactions to mui views`.
  - **Completion evidence:** [P00-26 verification](evidence/P00-26.md): dated public research, complete component/screen mapping, independent review, diagram/link/token/format checks.

- [x] **P00-27 — Refine workspace RBAC, audit fields and decorated contracts**
  - **Goal:** Complete the ER model and specify workspace-based authorization/field inheritance and the entity/DTO/Swagger/Next.js boundary before implementation.
  - **Requirements:** R111–R112; refines R12, R14, R16–R22, R30–R31, R56–R57, R67.
  - **Files:** `docs/{DATABASE_DESIGN,BACKEND_CONTRACTS,API_CATALOG,PLAN,SYSTEM_DESIGN,UI_DESIGN,DECISIONS,TASKS,REQUIREMENTS_MATRIX}.md`, architecture/README links and task evidence.
  - **Dependencies:** P00-26 and the user's workspace/audit/DTO refinement.
  - **Acceptance:** All 15 ER models show complete attributes including meaningful names and both timestamps; RBAC is per Membership; workspace field defaults resolve through all four levels. Explicit request/response DTOs, entity boundaries, decorators, safe projections and generated web contract flow are planned. No application implementation is claimed.
  - **Validation:** Independent database/API review; verify ER/dictionary attribute parity, timestamp coverage,43 unique operations, source links/diagrams, formatting and affected requirement status.
  - **Commit:** `docs: refine workspace access and api contracts`.
  - **Completion evidence:** [P00-27 verification](evidence/P00-27.md): all 15 ER/dictionary attribute sets and audit pairs match, 43 operations retained, two independent reviews and documentation checks pass.

- [x] **P00-28 — Specify every field and cursor-only pagination**
  - **Goal:** Make each stored/embedded field implementable from explicit types, relations and validation; allow only cursor pagination in the public API.
  - **Requirements:** R113–R114; refines R11–R14, R21, R31, R49, R58.
  - **Files:** `docs/{FIELD_REFERENCE,DATABASE_DESIGN,API_CATALOG,BACKEND_CONTRACTS,PLAN,UI_DESIGN,DECISIONS,TASKS,REQUIREMENTS_MATRIX}.md`, architecture/README links and evidence.
  - **Dependencies:** P00-27 and the user's field/pagination refinement.
  - **Acceptance:** All135 stored fields plus embedded/derived/request controls have type, null/default/ownership, relation and validation responsibility. Paginated operations use only cursor/limit; reject page/offset aliases, duplicate query keys, invalid/expired/context-mismatched cursors. Bound complete schemas are not paginated. No runtime behavior is claimed.
  - **Validation:** Exact field-reference/ER/dictionary parity,43 unique operations, independent DB/API reviews, diagrams/local links and formatting. Runtime constraints and pagination remain Planned until implemented tests pass.
  - **Commit:** `docs: specify field rules and cursor pagination`.
  - **Completion evidence:** [P00-28 verification](evidence/P00-28.md):135 stored-field rows match the ER/dictionary; typed embedded/request controls, cursor-only policy,43-operation inventory and documentation checks reviewed.

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

- [x] **P01-01 — Foundation contracts before HTTP endpoints**
  - **Goal:** Define shared enums, errors, pagination and immutable transport primitives.
  - **Files:** `packages/contracts/src/{enums,errors,pagination,identifiers,dates,index}.ts`, `packages/contracts/test/foundations.test.mjs`.
  - **Dependencies:** P00-04.
  - **Acceptance:** Zod schemas infer types for all requested enums, error codes/envelope, cursor page and strict IDs/calendar dates. Domain schemas reject unsupported values and unexpected identity fields. Include shared audit timestamp schema, workspace-role/action constants and workspace-inclusive field scope enum. Follow FIELD_REFERENCE bounds/types, reject NUL/lone-surrogate strings but preserve valid supplementary characters, and use cursor-only queries; reject offset/page aliases and duplicate query inputs.
  - **Validation:** Literal valid/invalid fixtures including leap dates, enum typos, negative/oversized limits and malformed issue paths; standard gate.
  - **Commit:** `feat: define shared transport contracts`.
  - **Completion evidence:** [P01-01](evidence/P01-01.md): seven Jest behavior/schema-export tests and root gates pass.

- [x] **P01-03 — Relational schema and migrations**
  - **Goal:** Persist the model with tenant-safe relations before repositories/endpoints use it.
  - **Files:** `packages/database/prisma/{schema.prisma,migrations/**}`, `packages/database/src/{client,index}.ts`, `packages/database/test/{schema.integration.test,postgres,fixtures}.mjs`, `packages/database/{prisma.config.ts,turbo.json,README.md}`, API/worker Dockerfiles (Prisma OpenSSL dependency).
  - **Dependencies:** P01-01 (DB-first execution per D75).
  - **Acceptance:** All DATABASE_DESIGN entities exist, including stable status identity, current-session partial unique index and selected-workspace FK, nullable inherited visibility, field JSONB, row/collection versions, refresh lineage, join tables and outbox. Every table has createdAt/updatedAt enforced for Prisma/raw SQL/worker paths; workspace field ownership is allowed and checked. Composite FKs prevent cross-tenant relations. Owner shape checks and indexes are checked in. A dedicated real Postgres test database is isolated from development.
  - **Validation:** Migrate empty database, verify constraints by rejected inserts, inspect all audit columns and immutable-createdAt/update-trigger behavior, field CHECKs and paired invitation/refresh/outbox state rules, restart/reapply migration, inspect required indexes; standard gate with real Postgres.
  - **Commit:** `feat: add tenant safe database schema`.
  - **Completion evidence:** [P01-03](evidence/P01-03.md): 43 real-Postgres cases, root gates and five-service Docker checks pass.

- [x] **P01-04 — Fail-closed tenant repositories and test harness**
  - **Goal:** Make tenant scoping the only persistence entry point for tenant data.
  - **Files:** `packages/database/src/{tenant-context,tenant-database,repositories,index}.ts`, `packages/database/test/{tenancy.integration.test,postgres}.mjs`, database README. API harness/identity access are introduced with their first real HTTP consumers in P01-02/P02-01.
  - **Dependencies:** P01-03.
  - **Acceptance:** Missing context fails; reads/writes/counts/pagination/relations/transaction access inject workspace scope; raw Prisma is not exported to apps. Workspace locking is transaction-bound. Fixtures/harness clean up an isolated database and work with Testcontainers or the documented test service.
  - **Validation:** Tenant A cannot read/update/delete/link tenant B records; forged workspace criteria cannot override context; callback transaction keeps scoping. Standard gate.
  - **Commit:** `feat: centralize tenant scoped persistence`.
  - **Completion evidence:** [P01-04](evidence/P01-04.md): 20 tenant-boundary tests plus all 43 schema tests; full root gates pass.

- [x] **P01-05 — Seed-once data and migration startup**
  - **Goal:** Make clean boot reproducible and demonstrate all major scenarios with real persisted data.
  - **Files:** `packages/database/src/{seed,seed-cli,password,initialize}.ts`, `packages/database/test/seed.integration.test.mjs`, `apps/api/src/main.ts`, API bootstrap tests, Compose/verification scripts, manifests and README. Add the shared option UUID/name/color schema required to validate real seed options before the full P05 field module.
  - **Dependencies:** P01-04.
  - **Acceptance:** Alice/Bob/Carol, two tenants, 2 spaces/2 folders/3 main lists, 24 tasks, inherited/overridden statuses, optional closed, 3+ multilevel fields (a workspace default, a lower-level definition and a list override) and private/denied lists exist. All seeded tasks satisfy the four-level effective schema. Migrate then seed once under a lock before API ready; repeated/concurrent boot preserves edits. Seed disabled outside demo mode.
  - **Validation:** Assert counts/relations/field validity, two parallel initializers, second boot after editing data, migration failure prevents readiness; standard gate and Compose boot.
  - **Commit:** `feat: initialize database with repeatable demo data`.
  - **Completion evidence:** [P01-05](evidence/P01-05.md): seed/rollback/concurrency checks, 240 root tests and Docker startup/restart checks pass.

- [x] **P01-02 — HTTP platform and early contract generation**
  - **Goal:** Establish real health endpoints, global error/validation/response handling and the minimum export/client pipeline required by every following endpoint.
  - **Files:** `apps/api/src/platform/**`, `apps/api/src/spec-bootstrap.ts`, `packages/contracts/src/health.ts`, `packages/openapi/{scripts/export.ts,openapi.json,.spectral.yaml}`, `packages/api-client/{openapi-ts.config.ts,src/generated/**}`, affected package manifests/Turbo config.
  - **Dependencies:** P01-05 (DB-first execution per D75).
  - **Acceptance:** `/health/live`, `/health/ready` and development `/docs` have typed schemas. Runtime readiness checks actual dependencies; spec bootstrap imports the real controller/DTO registry without sockets/DB/Redis. `pnpm gen:api` works, explicit operationIds and error schemas appear (follow API_CATALOG), and generated client compiles. Infrastructure URL exceptions are explicit. Follow BACKEND_CONTRACTS for createZodDto request/response classes, ZodResponse metadata, global serializer and safe500 output validation; generated response consumer compiles.
  - **Validation:** Supertest error-envelope/response tests; export/generation with runtime dependencies unavailable; malformed response fails safely; standard gate.
  - **Commit:** `feat: establish typed api platform and generation`.
  - **Completion evidence:** [P01-02](evidence/P01-02.md): 251 tests, build/lint/typecheck, generated contract drift checks and five-service Docker restart pass.

## Phase 2 — Authentication and membership

- [x] **P02-01 — Signup, login and default-deny authentication**
  - **Goal:** Establish password identity, atomic workspace creation and verified tenant context.
  - **Files:** `packages/contracts/src/auth.ts`, `apps/api/src/auth/{auth.module,auth.controller,auth.service,auth.guard,auth.dto,public.decorator}.ts`, `apps/api/test/auth.e2e-spec.ts`, generated artifacts.
  - **Dependencies:** P01-02.
  - **Acceptance:** Signup creates workspace/admin/default statuses atomically; login verifies Argon2id and normalizes email. JWT claims/audience/issuer/expiry checked, membership role read from DB. Guard is default-on with named public exceptions. Credential rate limiting and redacted logs exist.
  - **Validation:** Correct login; duplicate normalized email; wrong password; expired/forged token; unauthenticated domain route 401; body cannot set acting role/workspace; failed signup rolls back. Endpoint DoD and standard gate.
  - **Commit:** `feat: add workspace aware authentication`.
  - **Completion evidence:** [P02-01](evidence/P02-01.md): 269 tests, generated contract checks, all quality gates and Docker seeded login/restart pass.

- [x] **P02-02 — Rotating refresh sessions and logout**
  - **Goal:** Provide cookie refresh without token reuse or unsafe replay.
  - **Files:** `apps/api/src/auth/{auth.service,auth.controller,cookie-policy}.ts`, auth guard/DTO/contracts, `packages/database/src/identity.ts`, real API/database refresh tests, generated artifacts.
  - **Dependencies:** P02-01.
  - **Acceptance:** Random refresh digest only; atomic single-use rotation under the User lock with same-family lineage and fixed seven-day lifetime; JWT session identity remains familyId; reuse revokes family; logout invalidates session/cookie. Refresh with a removed selected membership returns403 without a retry loop; re-login recovers. Cookie Secure/SameSite/httpOnly policy, Origin validation and credentialed CORS are explicit. Auth endpoints never disclose password/token digests.
  - **Validation:** Cookie flags, rotation, replay, concurrent use, revoked/deleted membership, missing/bad Origin and cross-site refresh; endpoint DoD and standard gate.
  - **Commit:** `feat: rotate refresh sessions securely`.
  - **Completion evidence:** [P02-02](evidence/P02-02.md): 284 tests, all quality/contract gates, real refresh/replay/concurrency/logout checks pass.

- [x] **P02-04 — Complete Swagger descriptions and examples**
  - **Goal:** Make every current endpoint and DTO understandable from Swagger without duplicating validation definitions.
  - **Requirements:** R12, R20, R21, R91, R115.
  - **Files:** shared auth/health/error schemas, API auth/health decorators and documentation helpers, generated spec/client, contract/OpenAPI tests and harness docs.
  - **Dependencies:** P02-02; prioritized before P02-03 by the user's documentation request.
  - **Acceptance:** All six operations have summaries/descriptions; body-bearing requests/responses, schema fields and applicable headers have descriptions and examples; schema/field titles are present. Examples satisfy the shared schemas, use no real credentials, preserve write-only passwords, and keep logout204 body-free. Spectral enforces operation descriptions. Runtime behavior and validation remain unchanged.
  - **Validation:** Contract example validation and exported-document regression tests; full build/lint/test/typecheck/format and OpenAPI/client drift checks.
  - **Commit:** `docs: enrich swagger contracts with examples`.
  - **Completion evidence:** [P02-04](evidence/P02-04.md): all six operations and emitted schema fields documented; 290 tests, generated contract checks and standard gates pass; rendered Swagger verified.

- [x] **P02-05 — Adopt feature-based backend rules**
  - **Goal:** Make the Encore NestJS feature structure the documented default for backend work while preserving Flowboard's existing stack and contract boundaries.
  - **Requirements:** R116; maintains R20, R21, R91 and R115.
  - **Files:** `apps/api/AGENTS.md`, `docs/BACKEND_GUIDELINES.md`, root `AGENTS.md`, `ARCHITECTURE.md`, `README.md`, plan, decisions, quality gates, task/matrix/evidence records.
  - **Dependencies:** P02-04; prioritized by the user's article/rules request.
  - **Acceptance:** Feature layout, module exports/DI, controller/service/repository ownership, DTO/entity boundaries, complete Swagger metadata and endpoint workflow are explicit. Article-to-repository adaptations retain shared Zod, Prisma in database, generated client and central auth/permission/error handling. Current layout, future layout and review-only enforcement are distinguished; no runtime files move in this documentation task.
  - **Validation:** Source-to-guide review, relative-link checks, independent architecture review, formatting and existing root quality/contract gates. No artificial behavioral tests for documentation.
  - **Commit:** `docs: define feature-based backend conventions`.
  - **Completion evidence:** [P02-05](evidence/P02-05.md): sourced guide, scoped rules and future task paths reviewed; 179 local links, documentation-only diff and all root gates pass. Runtime restructuring remains P02-06.

- [x] **P02-06 — Organize backend modules, common code and tests**
  - **Goal:** Bring the current bootstrap/auth slice into feature modules, extract shared infrastructure/configuration/utilities, and split tests by purpose before growing membership functionality.
  - **Requirements:** R116, R117; preserves R20, R21, R91 and R115.
  - **Files:** `apps/api/src/app.module.ts`, `application.ts`, `main.ts`, `spec-bootstrap.ts`, `auth/**`, `platform/**`, `common/**`, `test/{unit,integration,bootstrap,common}/**`, API test/package configuration, backend rules and task/evidence docs. Generated artifacts only if reproducible output changes.
  - **Dependencies:** P02-05.
  - **Acceptance:** Auth/platform have modules and focused DTO files; AppModule composes modules. Shared decorators/errors/filters/Swagger, application/Redis config and reused utilities live under `common/`; auth-specific settings remain in auth. Unit, HTTP integration and bootstrap tests are separately discovered, with per-suite shared fixtures in `test/common/` and no shared mutable database/Redis singleton. Runtime and isolated spec bootstrap use the same controller registry; no raw database access moves into the API. Route names, validation, response schemas, auth/cookie behavior and OpenAPI output are preserved.
  - **Validation:** Config parsing tests first; all existing test names/assertions retained through the split. Real Postgres/Redis auth, refresh, outage, shutdown and platform tests; complete build/lint/test/typecheck/format/spec/client gates. Verify one-time cleanup and no startup side effects during spec export.
  - **Commit:** `refactor: organize api modules and tests`.
  - **Completion evidence:** [P02-06](evidence/P02-06.md): feature/common modules, shared config/utilities and isolated split test suites pass 296 tests, full quality/contract gates and five-service Docker startup/restart checks.

- [x] **P02-07 — Enforce spacing after exports and modules**
  - **Goal:** Automatically keep one blank line after exports, including exported NestJS module classes, whenever another statement follows.
  - **Requirements:** R118.
  - **Files:** shared ESLint spacing configuration/presets and regression tests, affected authored source whitespace, backend/code-quality/agent rules, decisions and evidence.
  - **Dependencies:** P02-06; prioritized by the user's formatting request.
  - **Acceptance:** Node/React/Next presets report and autofix missing spacing after exports, including decorated module classes, types and re-exports. Preserve comments/decorator attachment and runtime tokens; no extra blank line at EOF, no generated-file or JSON rewrites. Prettier and lint agree.
  - **Validation:** Red/green lint fixtures, all preset coverage and Prettier round-trip; full root build/lint/test/typecheck/format and contract drift checks.
  - **Commit:** `style: separate exports with blank lines`.
  - **Completion evidence:** [P02-07](evidence/P02-07.md): five spacing regressions, all 301 tests and quality/contract gates pass; 26 existing source/test files changed only by inserted blank lines.

- [x] **P02-08 — Add safe correlated backend logging**
  - **Goal:** Trace failures across HTTP, auth/services, database operations, infrastructure and worker lifecycle with structured logs and configurable levels.
  - **Requirements:** R119; preserves tenant and secret-handling safeguards.
  - **Files:** new Node-only `packages/logger/**`, API common logging/module/config and auth/platform boundaries, database operation/initialization boundaries, worker bootstrap, manifests/lockfile/boundary rules, environment examples/Compose and logging guide/evidence.
  - **Dependencies:** P02-07; prioritized by the user's logging request.
  - **Acceptance:** JSON logs support trace/debug/info/warn/error/fatal/silent and validated LOG_LEVEL; generated request IDs propagate across async work and verified identity context. Static operation/route/status/duration fields identify each layer. Errors, aborts, startup/shutdown and dependency failures are visible. Bodies, raw URLs/query, headers, credentials, SQL/parameters, arbitrary error messages/stacks and Prisma metadata never enter logs. Spec export and default tests are silent. Logging sink failures cannot change business outcomes; transaction completion is logged only after resolution.
  - **Validation:** Logger level/redaction/context/throwing-sink tests first; real HTTP correlation and failure tests plus DB rollback logs; existing full build/lint/test/typecheck/format/contract and Docker startup gates.
  - **Commit:** `feat: add correlated backend logging`.
  - **Completion evidence:** [P02-08](evidence/P02-08.md): 322 tests and build/lint/type/format/contract gates pass; five-service Docker login tracing, secret exclusion and restart checks pass.

- [x] **P02-09 — Flatten auth and platform feature folders**
  - **Goal:** Keep all auth/platform source files directly in their feature folder as requested, including DTO adapters and auth configuration.
  - **Requirements:** R120; preserves R116/R117 feature ownership and test separation.
  - **Files:** `apps/api/src/auth/**`, `apps/api/src/platform/**`, imports in `apps/api/src/main.ts` and API test helpers/unit tests; backend/agent rules, decisions, requirement matrix and evidence.
  - **Dependencies:** P02-08; prioritized by the user's folder-layout correction.
  - **Acceptance:** No subdirectories remain in auth/platform source. DTO names, shared Zod contracts, Nest wiring, configuration validation and HTTP/Swagger output remain unchanged. Common infrastructure and purpose-based test folders stay separate. Document this exception to the generic feature DTO-folder convention; no forwarding shims or stale imports.
  - **Validation:** Before/after directory assertions, clean API output and root build/lint/test/typecheck/format/OpenAPI checks; Docker startup/regression checks and read-only reference review. Refresh the ignored local code graph when available.
  - **Commit:** `refactor: flatten auth and platform folders`.
  - **Completion evidence:** [P02-09](evidence/P02-09.md): seven verified moves, no nested source/output folders, 322 tests and all quality/contract/Docker checks pass.

- [x] **P02-10 — Colocate auth and platform tests**
  - **Goal:** Keep feature tests beside auth/platform source without adding subfolders or shipping tests in application output.
  - **Requirements:** R121; preserves R117 isolation and R120 flat folders.
  - **Files:** eight relocated auth/platform suites, `apps/api/jest.config.mjs`, `apps/api/tsconfig.json`, `.dockerignore`, `scripts/check-compose.mjs` image assertion, release-planner test fixtures, active backend/agent/architecture/plan rules and evidence.
  - **Dependencies:** P02-09; prioritized by the user's test-layout follow-up.
  - **Acceptance:** Five auth and three platform suites live directly in their feature folder, using unit/integration filename suffixes. Jest discovers all 13 existing suites exactly once; shared common suites/helpers and process startup tests stay separate. Existing assertions and fixture isolation are preserved. Production output and Docker context exclude tests; test-only changes remain excluded from app releases.
  - **Validation:** Capture suite inventory; observe moved tests missing before updating discovery, then verify all suites restored. Run root build/lint/test/typecheck/format/OpenAPI and Docker checks; inspect clean build output, refresh local graph and review the diff.
  - **Commit:** `refactor: colocate auth and platform tests`.
  - **Completion evidence:** [P02-10](evidence/P02-10.md): all 13 Jest suites retained, 322 tests and quality/contract/Docker checks pass; production image excludes colocated tests.

- [x] **P02-11 — Use Pino for shared structured logging**
  - **Goal:** Replace handwritten log serialization/severity handling with a maintained logging library while preserving the safe shared facade and Nest adapter.
  - **Requirements:** R122; preserves R119 correlation/redaction guarantees.
  - **Files:** `packages/logger/{src/index.ts,test/logger.test.mjs,package.json}`, lockfile, logging/architecture/agent documentation and evidence.
  - **Dependencies:** P02-10; prioritized by the user's library request.
  - **Acceptance:** Pinned Pino handles JSON output, timestamps and severity filtering across API/database/worker. Preserve current event shape, isolated request context, safe metadata, silent spec/tests and non-interfering sink failures. Reject invalid levels before Pino can expose the supplied value. No framework dependency enters database/logger and no duplicate HTTP middleware is added.
  - **Validation:** Red/green invalid-level regression, existing logging/HTTP/auth/transaction tests, full build/lint/test/typecheck/format/OpenAPI and Docker checks.
  - **Commit:** `refactor: use pino for shared logging`.
  - **Completion evidence:** [P02-11](evidence/P02-11.md): 324 tests and all build/lint/type/format/contract/Docker gates pass with Pino-backed logging.

- [x] **P02-12 — Group DTO adapters by feature and type**
  - **Goal:** Reduce one-class DTO files while retaining separate request/response roles and every concrete schema/class.
  - **Requirements:** R123; preserves R120 flat folders and existing typed Swagger contracts.
  - **Files:** grouped auth/health DTO files and their controller imports; backend/agent/architecture rules, task/evidence records.
  - **Dependencies:** P02-11; execute after the logging task is verified and committed.
  - **Acceptance:** Use `auth.request.dto.ts`, `auth.response.dto.ts` and `health.response.dto.ts` for the existing six classes; no new DTO folder, forwarding exports, renamed schemas/classes or altered request/response behavior. Generated OpenAPI/client stay identical.
  - **Validation:** Class/content preservation and import checks, clean build, root lint/test/typecheck/format/OpenAPI and Docker verification.
  - **Commit:** `refactor: group dtos by feature and type`.
  - **Completion evidence:** [P02-12](evidence/P02-12.md): three grouped files preserve all six adapters; generated contracts are unchanged and all build/lint/type/test/format/OpenAPI/Docker gates pass.

- [x] **P02-13 — Separate feature modules and shared infrastructure**
  - **Goal:** Make backend ownership visible through the requested modules, config, utils and shared directories.
  - **Requirements:** R124; preserves R120/R121/R123 feature layout, test colocation and grouped DTOs.
  - **Files:** `apps/api/src/{modules,config,utils,shared,common}/**`, entry-point imports, API test imports, release-planner path fixtures, backend/agent/architecture rules and task/evidence records.
  - **Dependencies:** P02-12; prioritized by the user's folder-layout request before membership work.
  - **Acceptance:** Auth/platform and their tests live flat under `src/modules/`. Reusable config and utils move out of common to `src/config/` and `src/utils/`. `src/shared/` owns SharedModule and LoggingModule; common keeps HTTP helpers. Preserve provider registration, shutdown behavior, all existing test assertions, DTO classes and generated contracts. No forwarding shims, duplicate providers or empty speculative modules.
  - **Validation:** Observe the new-layout structural check fail first, preserve the suite inventory and source semantics through path changes, rebuild from clean API output, and run root build/lint/typecheck/test/format/OpenAPI/Docker gates plus independent review.
  - **Commit:** `refactor: organize api modules and shared code`.
  - **Completion evidence:** [P02-13](evidence/P02-13.md): layout/semantic checks, 324 tests and build/lint/type/contract/Docker gates pass; independent refresh clock finding is tracked in P02-14.

- [x] **P02-14 — Use database time for refresh-session creation**
  - **Goal:** Keep session lifecycle timestamps consistent when host and database clocks differ.
  - **Requirements:** R125; preserves refresh rotation/replay safety.
  - **Files:** `packages/database/prisma/schema.prisma`, the session-default migration, refresh integration tests, decisions and evidence.
  - **Dependencies:** P02-13; discovered by its full-suite verification.
  - **Acceptance:** Session audit defaults use database time instead of Prisma's host-generated now(). A deterministic host-clock-skew test proves create/rotate/replay obey lifecycle constraints. Keep fixed expiry, row locking, replay revocation and all DB constraints. Check in Prisma's two default reassertions without rewriting existing rows.
  - **Validation:** Observe clock-skew regression fail before the change; run real PostgreSQL refresh tests, Prisma schema validation, root build/lint/typecheck/test/format/OpenAPI/Docker checks.
  - **Commit:** `fix: use database time for refresh sessions`.
  - **Completion evidence:** [P02-14](evidence/P02-14.md): deterministic clock-skew red/green, preserved migration data, 326 tests and all build/lint/type/contract/format/Docker checks pass.

- [x] **P02-15 — Enforce ESM across authored workspaces**
  - **Goal:** Keep all application, package and tooling code on native ESM and prevent accidental CommonJS output.
  - **Requirements:** R126.
  - **Files:** root manifest, shared TypeScript/ESLint configs and tests, database initializer, commitlint launcher, web/worker Docker health commands, release CLI fixtures, architecture/rules and evidence.
  - **Dependencies:** P02-14; prioritized by the user's ESM request.
  - **Acceptance:** Root and workspaces declare module type; NodeNext emits native ESM with verbatim module syntax; authored code rejects CommonJS loading/exports. Replace CLI path-resolution bridges with import.meta.resolve. Preserve package exports, CLI execution, migrations, API contracts and Docker startup. Framework/vendor-generated internals keep their supported format.
  - **Validation:** Red/green compiler and lint fixtures; package module checks; full build/lint/typecheck/test/format/OpenAPI/Docker gates; inspect authored build output and independent review.
  - **Commit:** `refactor: enforce esm across the workspace`.
  - **Completion evidence:** [P02-15](evidence/P02-15.md): native ESM output audit, compiler/lint red-green fixtures, 329 tests and all build/type/format/contract/Docker checks pass.

- [x] **P02-16 — Adopt feature-first core layers with Express**
  - **Goal:** Apply the requested Medium architecture to existing foundations while keeping Express and Flowboard's package boundaries.
  - **Requirements:** R127; preserve R120–R124 and R126.
  - **Files:** `apps/api/src/{core,modules,shared}/**`, `application.ts`, `main.ts`, affected API test imports, `packages/config-eslint/src/boundaries.mjs`, boundary fixtures, architecture/rule/plan/decision/matrix docs and task evidence.
  - **Dependencies:** P02-15; prioritized by the user's architecture request before P02-03.
  - **Acceptance:** Foundation helpers/configuration live in `core/{common,config,utils}`; feature modules stay flat where requested; shared providers retain one registration/lifecycle. Core cannot depend on shared/features and shared cannot depend on features. Use an explicit ExpressAdapter for the common runtime/spec application factory. Keep Prisma in `packages/database`, preserve routes/contracts and avoid empty aggregator modules or compatibility shims.
  - **Validation:** Failing/passing import-boundary fixtures, Express HTTP regression, clean build and unchanged generated contracts; root build/lint/typecheck/test/format/OpenAPI checks and isolated Docker startup/restart checks (G01–G07, G11 as applicable).
  - **Commit:** `refactor: adopt feature-first core layers`.
  - **Completion evidence:** [P02-16](evidence/P02-16.md): guarded layer directions, explicit Express, preserved contracts and flat features; 340 tests and all build/lint/type/format/contract/Docker gates pass.

- [x] **P02-17 — Shared control-flow spacing for readable code**
  - **Goal:** Separate conditionals and return paths visually in frontend, backend and shared code.
  - **Requirements:** R128; preserve R118.
  - **Files:** `packages/config-eslint/src/spacing.mjs`, `test/spacing.test.mjs`, autofixed authored app/package/tooling files, shared coding rules, plan/decision/matrix docs and task evidence.
  - **Dependencies:** P02-16; prioritized by the user's readability request.
  - **Acceptance:** Node, React and Next presets require blank lines after complete if/else chains, before returns and after returns when a sibling statement follows. Preserve export spacing, comments, attached else clauses, return expressions, generated exclusions and JSON formatting. Do not add blank lines before closing braces or impose unrelated style rewrites.
  - **Validation:** Red/green real ESLint fixtures across three presets, comment/early-return/JSX cases, autofix/Prettier stability and unchanged syntax trees; root build/lint/typecheck/test/format and OpenAPI preservation checks. Docker checks if runtime syntax changes. G01–G06 as applicable.
  - **Commit:** `style: separate control flow with blank lines`.
  - **Completion evidence:** [P02-17](evidence/P02-17.md): three-preset spacing/autofix tests, unchanged existing syntax and 348 tests; build/lint/type/format/contract checks pass.

- [x] **P02-18 — Use localhost for local development**
  - **Goal:** Make localhost the consistent address developers use for the web, API, worker and local datastore examples.
  - **Requirements:** R129.
  - **Files:** App development/runtime configuration, app environment examples and startup tests, Compose origin default, README, plan/decision/matrix docs and task evidence.
  - **Dependencies:** P02-17; prioritized by the user's localhost request.
  - **Acceptance:** Web development and local API/worker listeners default to localhost; documented URLs and local connection examples use localhost; default browser origin is exactly http://localhost:3000. Explicit hosted/container host overrides remain valid. Keep numeric Docker loopback port bindings and IPv4 health probes; never broaden exposure. Preserve security validation of alternate explicitly configured loopback origins.
  - **Validation:** Failing/passing default-config test, web/worker localhost startup and shutdown, auth regressions, root build/lint/typecheck/test/format/OpenAPI checks and isolated Docker startup/restart. G01–G07 and G11 as applicable.
  - **Commit:** `fix: use localhost for local development`.
  - **Completion evidence:** [P02-18](evidence/P02-18.md): localhost defaults, dev/production smoke checks and 348 tests pass; build/lint/type/format/contract/Docker checks pass.

- [x] **P02-19 — Load ignored local environment files**
  - **Goal:** Make local development usable with checked-in examples and private per-app environment files.
  - **Requirements:** R130.
  - **Files:** API/worker package scripts and startup tests, shared test command helper, API environment example, README, task/decision/matrix/evidence docs; ignored `.env`, `apps/api/.env`, `apps/worker/.env`, `apps/web/.env.local`.
  - **Dependencies:** P02-18; prioritized by the user's local environment request.
  - **Acceptance:** API and worker dev/start commands load optional local .env files using Node's native loader; inherited variables take precedence. Next uses .env.local and Compose uses root .env. Populate local-only credentials/settings without overwriting existing values. Local files remain ignored by Git and excluded from Docker; no secrets enter generated output or browser variables. Document datastore startup and server commands.
  - **Validation:** Real startup-command red/green tests for local values, missing files and environment precedence; root build/lint/type/test/format/OpenAPI checks, Docker exclusion/config checks and local API readiness/login verification against PostgreSQL/Redis. G01–G07/G11 as applicable.
  - **Commit:** `fix: load local environment files for development`.
  - **Completion evidence:** [P02-19](evidence/P02-19.md): 12 startup-command cases and all 360 tests pass; local API readiness/login and private-file exclusions verified; root build/lint/type/format/contract/Docker checks pass.

- [x] **P02-20 — Document the local Docker run workflow**
  - **Goal:** Make README startup, configuration, diagnostics and shutdown instructions directly usable for local Docker development.
  - **Requirements:** R86; documentation slice only.
  - **Files:** `README.md`, `docs/TASKS.md`, `docs/REQUIREMENTS_MATRIX.md`, `docs/evidence/P02-20.md`.
  - **Dependencies:** P02-19; prioritized by the user's Docker README request.
  - **Acceptance:** Explain Docker/Compose prerequisites, root env versus per-app env, foreground/background startup, health and Swagger URLs, demo initialization, logs, port conflicts, rebuilding and shutdown with data retained. Commands match the current Compose configuration; do not change runtime code or the user's running stack.
  - **Validation:** Compose configuration and CLI option checks, relative-link/Markdown checks, formatting and diff review. G01 plus documentation structural checks; application build/test gates are not applicable to this docs-only change.
  - **Commit:** `docs: explain local Docker startup and operation`.
  - **Completion evidence:** [P02-20](evidence/P02-20.md): Compose defaults/local configuration, CLI compatibility, README links and formatting verified; runtime unchanged.

- [x] **P02-21 — Reload local source changes inside Docker**
  - **Goal:** Show saved local code changes in running Docker development apps without manual rebuilds for each edit.
  - **Requirements:** R131.
  - **Files:** App Dockerfiles/package scripts, container-specific Turbo task configuration, `compose.dev.yaml`, Docker context exclusions/development verification script, parallel CI container matrix/regression, README, plan/decision/matrix/evidence docs.
  - **Dependencies:** P02-20; prioritized by the user's live-update request.
  - **Acceptance:** An opt-in development command runs web/API/worker with source mounts and dependency-aware watchers; app and shared-package edits become observable. Linux dependencies, build output and secrets remain isolated; runtime users stay non-root. Invalid code recovers after correction. Normal release images remain unchanged in behavior. Document rebuild boundaries and retain datastore contents across reloads.
  - **Validation:** Observe a live-edit regression before implementation, then verify web/API/worker and shared-package updates in an isolated copied fixture. Check mounts, private-file exclusion, data retention and error recovery. Run root build/lint/type/test/format/OpenAPI, existing Docker acceptance and new development Docker acceptance. G01–G07/G11 as applicable.
  - **Commit:** `feat: reload source changes in Docker development`.
  - **Completion evidence:** [P02-21](evidence/P02-21.md): real app/shared-package live edits, compile-error recovery, stable health and restart counts, source/output isolation and data preservation verified; 360 tests and both Docker suites pass; parallel CI checks added.

- [x] **P02-22 — Publish development datastore ports on localhost**
  - **Goal:** Connect host database/Redis tools to the live Docker development stack.
  - **Requirements:** R132.
  - **Files:** `compose.dev.yaml`, `scripts/check-compose-dev.mjs`, README, plan/decision/matrix/evidence docs.
  - **Dependencies:** P02-21; prioritized by the user's development port request.
  - **Acceptance:** Development publishes PostgreSQL on localhost:5432 and Redis on localhost:6379 by default, with POSTGRES_PORT/REDIS_PORT overrides. Base Compose keeps datastores private. Isolated tests use random ports and verify PostgreSQL and Redis protocol responses from the host; preserve data and existing credentials.
  - **Validation:** Red/green Compose configuration assertions and host protocol probes, full development Docker suite, base Compose privacy check, root build/lint/type/test/format/OpenAPI checks. G01–G05/G11.
  - **Commit:** `feat: expose development datastore ports locally`.
  - **Completion evidence:** [P02-22](evidence/P02-22.md): localhost defaults/overrides and base privacy checked; real PostgreSQL/Redis host probes and full development Docker suite pass; current stack updated with preserved data; all 360 tests and root checks pass.

- [x] **P02-23 — Make local Swagger authentication executable**
  - **Goal:** Allow Swagger's browser origin to use the documented local authentication endpoints.
  - **Requirements:** R133; preserves R20/R33/R35.
  - **Files:** Root/API `.env.example`, `compose.yaml`, README, auth configuration/integration tests, shared test fixture, plan/decision/matrix/evidence docs. Update ignored local env files without committing secrets.
  - **Dependencies:** P02-22; prioritized by the user's reported Swagger Execute failure.
  - **Acceptance:** Local defaults explicitly allow the web and Swagger origins; Compose defaults follow custom published ports. Explicit allowlist overrides remain authoritative. Browser login, cookie refresh and logout work in Swagger; missing/unlisted origins still fail. Existing credentials and data remain intact.
  - **Validation:** Failing local configuration regressions, real PostgreSQL/Redis auth lifecycle test, browser Execute reproduction and recovery, root build/lint/type/test/format/OpenAPI checks and Docker configuration/runtime checks. G01–G05/G07/G11.
  - **Commit:** `fix: allow local Swagger authentication requests`.
  - **Completion evidence:** [P02-23](evidence/P02-23.md): browser login/refresh/logout return 200/200/204; real origin rejection and custom-port regressions pass; all 366 tests, Docker and root gates pass.

- [x] **P02-03 — Membership, invitations and workspace switching**
  - **Goal:** Support real multi-workspace identity and admin-managed access.
  - **Requirements:** R30, R32, R34; contributes to R42/R92/R114 and preserves R29/R31/R33/R35.
  - **Files:** `packages/contracts/src/{workspaces,events,pagination}.ts`, database identity/membership repositories and tests, `apps/api/src/modules/{auth,workspaces,permissions}/**`, shared cursor/auth helpers and runtime composition, generated artifacts, README, API catalog, requirement matrix and task evidence.
  - **Dependencies:** P02-02, P02-06.
  - **Acceptance:** `/me`, paginated workspaces/members, add/invite/accept/remove/role change and verified workspace switch work. Invite is an expiring manually shared token with digest storage and email match; browser invitation links belong to the later web UI. Establish the one PermissionGuard/PermissionService with the membership/admin policy now; P03-02 extends it to containers. Remove departing members' grants/assignments atomically, bump affected task versions/emit outbox updates, and retain activity. No controller-local authorization, self-escalation or last-admin removal. The same user can be admin in workspace A and member in B; role changes apply on the next request without global-role leakage.
  - **Validation:** Expired/reused invite, wrong email, cross-tenant switch, member cannot grant admin, concurrent last-admin demotions, removed member token fails; endpoint DoD and standard gate.
  - **Commit:** `feat: manage workspace membership and invites`.
  - **Completion evidence:** [P02-03](evidence/P02-03.md): nine authenticated operations; permission, invitation, cursor, rotation and removal/race regressions; all 383 tests, root gates and Docker acceptance pass.

## Phase 3 — Hierarchy and authorization

- [x] **P03-01 — Strict hierarchy CRUD and archive**
  - **Goal:** Implement space/folder/list records with valid parents and soft deletion.
  - **Requirements:** R36/R37; contributes to R32/R42/R91/R92/R114.
  - **Files:** `packages/contracts/src/{nodes,events}.ts`, database hierarchy repository/shared event helper and integration tests, `apps/api/src/modules/hierarchy/**`, permission metadata and runtime composition, generated artifacts, README and task evidence.
  - **Dependencies:** P02-03.
  - **Acceptance:** Create/read/rename/archive nodes; exact parent types enforced; IDs cannot cross tenants. Archive removes whole subtree/tasks from normal reads atomically. Until P03-02 adds complete member visibility, all new node routes are admin-only through the established PermissionGuard, including reads. Reparenting waits for P06-05.
  - **Validation:** Skip-level/cycle/self-parent attempts, archived ancestors, cross-tenant parent, repeat archive behavior and rollback; endpoint DoD and standard gate.
  - **Commit:** `feat: add validated hierarchy containers`.
  - **Completion evidence:** [P03-01](evidence/P03-01.md): four typed admin endpoints, tenant/parent/version validation, atomic subtree/task archive with rollback and race coverage; all 395 tests, root gates and Docker acceptance pass.

- [x] **P03-02 — Central permission policy, grants and visible tree**
  - **Goal:** Make tree/direct access agree on ancestor-aware visibility.
  - **Files:** `packages/contracts/src/{permissions,tree}.ts`, `apps/api/src/modules/permissions/**`, `apps/api/src/modules/hierarchy/tree.controller.ts`, `apps/api/src/modules/permissions/*.spec.mjs`, `packages/database/src/access-repository.ts`, repository and contracts tests, cursor/runtime composition, generated artifacts.
  - **Dependencies:** P03-01.
  - **Acceptance:** PermissionGuard + PermissionService are the only access policy. Admin bypass is tenant-local; private ancestors require explicit allow; ancestor deny prunes subtree. Cursor-only paginated flat tree contains visible nodes/parents only, orders parents before children, and rejects stale revision-bound cursors. Grants are admin-managed and transactions recheck authorization.
  - **Validation:** Alice sees all; Bob lacks private list; Carol allow works; Bob direct denied list 403; child allow cannot bypass parent deny/private; foreign IDs 404; counts/grants do not leak. Endpoint DoD and standard gate.
  - **Commit:** `feat: enforce container permissions centrally`.

- [x] **P03-03 — Deterministic sibling reordering**
  - **Goal:** Order visible hierarchy without client-controlled positions or race corruption.
  - **Files:** `packages/contracts/src/ordering.ts`, hierarchy service/controller, `packages/database/src/hierarchy-repository.ts`, colocated ordering API and repository tests, generated artifacts.
  - **Dependencies:** P03-02.
  - **Acceptance:** Neighbor-ID move API assigns integer positions transactionally, validates sibling set, increments every changed sibling version once and the workspace collection revisions, with stable ID tie-breaks.
  - **Validation:** First/last/empty position, wrong-parent/foreign anchors, duplicate anchors, stale version and concurrent reorder; endpoint DoD and standard gate.
  - **Commit:** `feat: reorder hierarchy siblings atomically`.

## Phase 4 — Scoped statuses

- [x] **P04-01 — Pure status resolution with stable identity**
  - **Goal:** Define one algorithm for API decisions and UI previews.
  - **Files:** `packages/contracts/src/{statuses,status-resolution}.ts`, `packages/contracts/test/status-resolution.test.mjs`.
  - **Dependencies:** P03-03.
  - **Acceptance:** `resolveStatuses` merges root-to-leaf by key; display overrides preserve identity/category; hidden/unhidden provenance and deterministic ordering are explicit. Invalid required-category sets return typed validation issues.
  - **Validation:** Known array fixtures for inherited/overridden/added/hidden/restored keys, immutable IDs, tied positions, missing categories and sibling isolation; standard gate.
  - **Commit:** `feat: resolve scoped statuses by stable key`.

- [x] **P04-02 — Status configuration and list resolution endpoints**
  - **Goal:** Expose typed status CRUD and the authoritative resolved-list status endpoint.
  - **Files:** `apps/api/src/modules/statuses/**`, central permission/exception handling, `packages/contracts/src/{statuses,status-configuration}.ts`, `packages/database/src/status-repository.ts`, generated artifacts and documentation.
  - **Dependencies:** P04-01.
  - **Acceptance:** Scoped config endpoints and `GET /v1/lists/:id/resolved-statuses` use the same pure resolver. Admin-only config, readable resolved sets follow list access. Stable identities and local overrides serialize distinctly. Basic in-use/descendant safety ships with these writes; P04-03 expands its regression coverage. Mutations increment configVersion and reads return it from the same snapshot as their items.
  - **Validation:** Two sibling lists under one folder return different expected sets; override retains task statusId; illegal category edits, invalid owner, forbidden scope and invalid sets reject. Endpoint DoD and standard gate.
  - **Commit:** `feat: expose scoped status configuration`.
  - **Completion evidence:** [P04-02 verification](evidence/P04-02.md): five typed operations, six real-API cases, 442 full-suite tests and all standard/contract gates pass.

- [x] **P04-03 — Safe status mutation across descendants**
  - **Goal:** Prevent orphaned tasks when ancestor configuration changes.
  - **Files:** `packages/database/test/{statuses.integration.test,cleanup.integration.test,postgres}.mjs`, `apps/api/src/modules/{statuses/statuses,platform/test-infrastructure}.integration.spec.mjs`, `apps/api/test/common/infrastructure.mjs`, task/decision/evidence records. Safety stays inside the existing tenant transaction; no forwarding service.
  - **Dependencies:** P04-02.
  - **Acceptance:** Proposed mutations validate owning scope and all affected active descendant lists under one lock. Hide/delete rejects in-use effective statuses. Physical identity deletion respects archived references. Removing overrides re-evaluates fallback.
  - **Validation:** Parent hide with child task, hiding last active/done, safe unused deletion, child overrides unaffected where appropriate, rollback leaves all lists valid; endpoint DoD and standard gate.
  - **Commit:** `test: verify status mutation safety`.
  - **Completion evidence:** [P04-03 verification](evidence/P04-03.md): 12 added regressions, 454 full-suite tests and all standard gates pass; test-owned anonymous volume cleanup prevents repeated disk growth.

## Phase 5 — Custom fields

- [x] **P05-01 — Pure field resolution and value validation**
  - **Goal:** Share exact field precedence/types across server and forms.
  - **Files:** `packages/contracts/src/{custom-fields,fields,field-resolution,field-values}.ts`, `packages/contracts/test/field-values.test.mjs`, plan/decision/evidence records.
  - **Dependencies:** P04-03.
  - **Acceptance:** Resolve workspace → space → folder → list; nearest full definition wins. All six field types, strict calendar dates, finite numbers, unique option IDs, required semantics and path-based errors are specified; null clear and omitted value differ.
  - **Validation:** Wrong types, unknown/duplicate options/keys, blank required text, missing required, invalid dates, zero/false accepted, nearest collision changes entire schema; standard gate.
  - **Commit:** `feat: resolve and validate custom fields`.
  - **Completion evidence:** [P05-01 verification](evidence/P05-01.md): 35 added contract cases, 489 full-suite tests and all standard/contract gates pass; API integration remains P05-02.

- [x] **P05-02 — Custom-field configuration and resolved schemas**
  - **Goal:** Add scoped field CRUD and authoritative list schemas.
  - **Requirements:** R13, R29, R31, R32, R40, R41, R42, R56, R57, R60, R61, R71, R91, R92.
  - **Files:** `apps/api/src/modules/fields/**`, `packages/contracts/src/field-configuration.ts`, `packages/database/src/{field,scope}-repository.ts`, colocated/API and database integration tests, generated artifacts.
  - **Dependencies:** P05-01.
  - **Acceptance:** Workspace/space/folder/list owners, workspace ownerId equals active tenant, admin-only mutations, typed options and provenance, `GET /v1/lists/:id/resolved-fields`. Uses shared resolver and tenant repositories. In-use/descendant validation ships with the first write routes; P05-03 hardens edge coverage. Mutations increment configVersion and resolved reads return a consistent version.
  - **Validation:** Owner mismatch/foreign workspace, workspace defaults inherited across separate spaces, list override, field-key collision, sibling independence, member writes 403, foreign fields 404 and schema response shape; endpoint DoD and standard gate.
  - **Commit:** `feat: expose scoped custom field schemas`.
  - **Completion evidence:** [P05-02 verification](evidence/P05-02.md): five typed endpoints, six-type/all-scope CRUD and safety/isolation tests; all 500 tests and standard/contract gates pass.

- [x] **P05-03 — Reject destructive field-schema changes**
  - **Goal:** Keep stored task values valid after ancestor/local configuration changes.
  - **Requirements:** R60, R61, R31, R32, R41, R42, R71.
  - **Files:** `packages/database/test/field-safety.integration.test.mjs`, `apps/api/src/modules/fields/fields.integration.spec.mjs`, existing field service/repository only if tests expose a defect, task/matrix/evidence documentation.
  - **Dependencies:** P05-02.
  - **Acceptance:** Validate every affected live list/task transactionally, including workspace-root changes and the 100-effective-field cap. Shadowed definitions are evaluated from their final resolved schema. Block deletion of in-use effective definition, invalid option removal, incompatible type changes, required promotion with missing values, and invalid fallback exposed by deleting override. Document optional→populate→required workflow.
  - **Validation:** Each rejected mutation returns field paths and preserves definitions/tasks; zero/false do not falsely block required promotion; safe unused deletion succeeds. Endpoint DoD and standard gate.
  - **Commit:** `test: guard destructive field schema changes`.
  - **Completion evidence:** [P05-03 verification](evidence/P05-03.md): 18 added regression cases, including a real HTTP demotion race; all 518 tests and standard/contract gates pass.

## Phase 6 — Tasks and atomic moves

- [ ] **P06-01 — Task reads, cursor pagination and filters**
  - **Goal:** Load board/list/drawer data without leaks or unstable pagination.
  - **Files:** `packages/contracts/src/tasks.ts`, `apps/api/src/modules/tasks/{tasks.module,tasks.controller,task-query.service}.ts`, `apps/api/src/modules/tasks/dto/*.dto.ts`, `apps/api/test/integration/task-queries.spec.mjs`, generated artifacts.
  - **Dependencies:** P05-03.
  - **Acceptance:** List task pages/detail include requested built-ins and customFields, never secrets. Due/priority sorting, stable null ordering and one typed custom-field filter work. Cursor binds resource/filter/sort and limit is bounded. Task pages include configVersion from the same transaction snapshot.
  - **Validation:** No duplicate/skipped ties on stable dataset, malformed/mismatched cursor 400, hidden/foreign task access, null dates and all priorities, option filter types; endpoint DoD and standard gate.
  - **Commit:** `feat: query paginated tasks with typed filters`.

- [ ] **P06-02 — Validated task create, edit and archive**
  - **Goal:** Persist complete valid tasks and durable event intent.
  - **Files:** `apps/api/src/modules/tasks/task-write.service.ts`, `packages/contracts/src/events.ts`, task controllers/repositories, assignable-member filter/contracts, `apps/api/test/integration/task-writes.spec.mjs`, generated artifacts.
  - **Dependencies:** P06-01.
  - **Acceptance:** Validate title ≤500, Markdown string, dates, destination status, members/assignee access and effective custom fields. PATCH omission/clear semantics and expected versions work. Member listing accepts an authorized assignableToListId filter for eligible assignee choices. Task update and outbox insert commit together. Archive removes task from normal reads.
  - **Validation:** Unknown statusId 400; foreign/disallowed assignee; title 501; wrong type/option/missing required; explicit clear; stale edit 409; rollback emits no event. Endpoint DoD and standard gate.
  - **Commit:** `feat: write tasks with scoped validation`.

- [ ] **P06-03 — Cross-list moves and column ordering**
  - **Goal:** Move cards atomically while preserving valid status, fields and ordering.
  - **Files:** `apps/api/src/modules/tasks/task-move.service.ts`, task contracts/controller, `apps/api/test/integration/task-moves.spec.mjs`, generated artifacts.
  - **Dependencies:** P06-02.
  - **Acceptance:** Source/destination permissions checked; preserve status or map first same category; missing category rejects. Move accepts required field values/explicit clears. Reorder validates neighbor list+column and versions; each changed task version advances once, dataVersion advances once, and one transaction updates everything/outbox.
  - **Validation:** Same-category mapping success; closed→no closed rejects; required destination field missing rejects/provided succeeds; source-only value needs explicit clear; wrong anchors/tenant reject; concurrent config/move remains valid; failure leaves task unchanged. Endpoint DoD and standard gate.
  - **Commit:** `feat: move and reorder tasks atomically`.

- [ ] **P06-04 — Complete task invariants and contract regression**
  - **Goal:** Audit all task entry points against the required negative scenarios.
  - **Files:** `apps/api/test/integration/{tenant-isolation,task-invariants}.spec.mjs`, `packages/contracts/test/task-patches.test.ts`, necessary task/repository fixes, generated artifacts.
  - **Dependencies:** P06-03.
  - **Acceptance:** REST tests cover tenant reads/writes/relationships, denied list, parent configuration changes, status deletion and field safety with actual task APIs. No orphaned active cards; all response bodies satisfy contracts. Cursor tampering/expiry/context changes and offset/page/duplicate parameters return400; visible rows determine limit+1/hasNextPage; revision changes return409 and a restart returns each current row once.
  - **Validation:** Full real-Postgres suite with two tenants; standard gate. Fix actual defects rather than weaken expectations.
  - **Commit:** `test: cover task isolation and mutation invariants`.

- [ ] **P06-05 — Validated container reparenting**
  - **Goal:** Complete container moves now that status and field rules are available.
  - **Files:** `apps/api/src/modules/hierarchy/node-move.service.ts`, node contracts/controller, `apps/api/test/integration/node-moves.spec.mjs`, generated artifacts.
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
  - **Acceptance:** `setupClient` configures an instance with base URL/credentials/token lookup, coordinates refresh and retries each rejected request once. Uses generated refresh SDK through an unwrapped instance; guards recursion and preserves abort. No retry for arbitrary network failure or forbidden 403. Defines origin-scoped tab lock and failure reauth behavior. Switch and refresh share that lock; generation checks prevent retrying an old-workspace request in a new workspace.
  - **Validation:** Concurrent 401s trigger one refresh; refresh failure/replayed token stops; 403 never refreshes; mutation retried at most once only after 401; aborted request stays aborted; instance state never shared across SSR requests; standard gate.
  - **Commit:** `feat: configure generated client session refresh`.

- [ ] **P07-04 — Same-origin browser transport for hosted authentication**
  - **Goal:** Preserve rotating httpOnly cookies when the web and API use separate provider domains.
  - **Requirements:** R29, R33, R91; follows D57.
  - **Files:** `apps/web/app/api/v1/[...path]/route.ts`, `apps/web/src/server/api-proxy.ts`, proxy integration tests, `packages/api-client/src/setup-client.ts`, `packages/config-eslint/src/boundaries.mjs`, `packages/config-eslint/test/boundaries.test.mjs`, server environment docs.
  - **Dependencies:** P07-03.
  - **Acceptance:** Browser-generated requests use same-origin `/api/v1`; the server forwards only to a fixed runtime-configured API origin and `/v1` paths. Preserve abort/status/body and separate Set-Cookie headers; forward only approved headers, validate browser Origin for cookie mutations, bypass caches and reject arbitrary destinations/redirects. Host-only refresh cookies use Path=/, Secure on HTTPS and SameSite=Lax. Forward only approved cookie names. The lint exception permits direct fetch only in the designated server-only proxy module; feature-code fetches remain rejected. No domain logic or second endpoint client in the proxy. Socket.IO connects directly to API with memory-held access JWT. CLI clients retain direct `/v1` access.
  - **Validation:** Integration tests with distinct web/API origins cover login/refresh/logout cookies, malicious origins/paths, no caching, upstream failure/abort, rejection of feature-code fetches, and no browser exposure of the upstream configuration. Browser tests prove refresh on separate-site hosts; standard gate.
  - **Commit:** `feat: proxy browser api transport on same origin`.

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
  - **Dependencies:** P08-02, P07-04.
  - **Acceptance:** Signup/login/refresh bootstrap/logout/workspace switch, one browser QueryClient, accessible collapsible paginated tree, list selection in URL. Loading/error/empty/forbidden states. Clear caches and sockets when identity changes; no prior-tenant flash.
  - **Validation:** Login errors, refresh expiry, logout then Bob after Alice, private list hidden, tree loading all pages, browser-back selection and mobile sidebar; standard gate.
  - **Commit:** `feat: add authenticated workspace shell`.

## Phase 9 — Board, list and drawer

- [ ] **P09-01 — Resolved Kanban board**
  - **Goal:** Render each list from its authoritative statuses and tasks.
  - **Files:** `apps/web/src/features/board/{board,board-data,use-board}.tsx`, board tests, board route.
  - **Dependencies:** P08-03.
  - **Acceptance:** Parallel generated queries load statuses/fields/tasks; render only matching configVersions across schemas/data and matching dataVersions across all task columns/pages; refetch mismatches with bounded retries. Exact columns including empty ones, requested card metadata and pagination. No orphan fallback column. List change isolates cached data and reports schema errors.
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
  - **Acceptance:** Workspace/space/folder/list field CRUD, local/inherited nearest-key preview, options with stable IDs and required-state guidance. Failed in-use/type/required mutation preserves editor values.
  - **Validation:** Dynamic option identity on reorder/remove, duplicate keys/options, required promotion rejection, inherited override removal, field-path errors and role restrictions; standard gate.
  - **Commit:** `feat: manage inherited custom field configuration`.

## Phase 11 — Durable activity and realtime

- [ ] **P11-01 — Durable outbox dispatch to BullMQ**
  - **Goal:** Deliver persisted task events after commit, surviving Redis outages.
  - **Files:** `apps/api/src/modules/outbox/**`, `packages/contracts/src/{events,jobs}.ts`, `apps/api/test/integration/outbox.integration.test.ts`, Redis test harness/config.
  - **Dependencies:** P10-02.
  - **Acceptance:** Claim/retry durable events; stable event ID/job ID; bounded backoff and observable failures. No lost intent after DB commit, no event from rolled-back write, multiple dispatchers safely claim work.
  - **Validation:** Redis unavailable then recovers, dispatcher crash/retry, duplicate attempts, two dispatchers, malformed job schema; standard gate with real Redis/Postgres.
  - **Commit:** `feat: dispatch durable task events to bullmq`.

- [ ] **P11-02 — Idempotent activity worker and drawer feed**
  - **Goal:** Turn status-change events into stored, visible activity.
  - **Files:** `apps/worker/src/{main,activity.processor,health,search-index.stub}.ts`, `apps/worker/test/activity.integration.test.ts`, `apps/api/src/modules/activity/**`, `apps/web/src/features/tasks/activity-feed.tsx`, generated artifacts.
  - **Dependencies:** P11-01.
  - **Acceptance:** Worker verifies each job against its persisted outbox record, derives tenant context, and inserts one Activity per event. Paginated authorized activity endpoint and drawer feed show actor/time/from/to. Publication retries even if Activity already exists; mark delivery complete only after successful publish. Graceful worker shutdown/heartbeat. Search stub is explicit `TODO(NEXT-01)` and does not advertise indexing.
  - **Validation:** Duplicate/retried delivery yields one activity; crash after Activity insert but before publish recovers the notification; malformed/cross-tenant payload blocked; forbidden task feed 403; empty/loading/error feed states; endpoint DoD and standard gate.
  - **Commit:** `feat: persist and display task activity`.

- [ ] **P11-03 — Permission-safe Socket.IO collaboration**
  - **Goal:** Update other clients while preserving tenant and resource access.
  - **Files:** `apps/api/src/modules/realtime/**`, `apps/api/test/integration/realtime.integration.test.ts`, `apps/web/src/features/realtime/**`, realtime browser tests.
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
