# Flowboard Quality Gates

A gate states what must be demonstrated before calling work complete. Documentation describes the gate; executable tools enforce it only after their owning task lands. **Today the repository has planning documents, not a working application or installed quality pipeline.** No table below is evidence that a future check already passes.

## Gate catalogue

| Gate | Trigger | Required evidence | Enforcement task |
|---|---|---|---|
| G01 Scope and traceability | Every task | Task/dependencies identified; affected requirement IDs and acceptance named; unrelated changes excluded. | P-001 process; reviewed every task |
| G02 Architecture boundaries | Any source/config change | Valid imports pass; deliberate forbidden fixture imports fail; no app→app or unapproved package→app access. | P00-02 |
| G03 Build and types | Every implementation task | Root build succeeds, exported packages resolve, strict type checks run through actual package scripts. | P00-01, P00-03 |
| G04 Lint and conventions | Every implementation task | Root lint succeeds without introducing blanket suppression or skipping changed files. | P00-01, P00-02 |
| G05 Behavior or bootstrap verification | Every implementation task | For behavior, observe the relevant failure first, then pass owning tests and the root suites. For scaffold/config-only work before behavior exists, meaningful structural, export or build-graph checks satisfy the gate; record application behavior tests as not applicable. | P00 bootstrap checks; P01-01 onward behavior tests |
| G06 API contract | Add/change endpoint/schema | Typed contract/DTO/response, operationId, auth policy, spec/client regeneration and drift checks agree. | P01-02 baseline; P07-01/P07-02 full checks |
| G07 Tenant and access safety | Persistence, resource access, auth, events | Tenant A cannot read/write/link tenant B; unauthorized direct/tree/socket access fails with specified semantics. | P01-04, P02-01, P03-02, P11-03 |
| G08 Domain consistency | Status/field/task/container mutation | Required categories and effective field schema hold across affected descendants; rollback/stale-write tests pass. | P04-01 through P06-05 |
| G09 Client and form behavior | Query/cache/form changes | Generated transport used; refresh once; cache separation; failure rollback; dirty-input preservation and issue paths verified. | P07-03, P08-02, P08-03, P09-02/P09-04 |
| G10 UI accessibility | Interactive UI changes | Keyboard alternatives/focus/labels, meaningful states, long content, target widths and reduced motion checked. | P08-01 through P10-02; P12-01 |
| G11 Delivery and recovery | Docker, startup, worker or realtime change | Honest health, clean initialization, retries/idempotency, no pre-commit events, permission-safe subscriptions demonstrated. | P00-04, P01-05, P11-01 through P11-03 |
| G12 Release acceptance | Completing a phase/release | Relevant matrix entries verified, no hidden deferrals, clean checkout and Docker/user journeys pass at release. | Phase exit review; P12-01 through P12-03 |

Every completed implementation task requires G01, G03, G04 and G05. Other gates apply by the changed behavior. A docs-only task requires scope/traceability and structural checks; it does not require pretending application tests exist.

## Planned command contract

These are the promised interfaces to introduce through the tasks below. Until present in actual package scripts, their state is `not_available`.

| Command | Meaning | Introduced/completed |
|---|---|---|
| `pnpm build` | Turbo builds all workspace outputs and performs package type validation. | P00-01/P00-03 |
| `pnpm lint` | Turbo runs package lint and boundary checks. | P00-01/P00-02 |
| `pnpm test` | Turbo runs all introduced suites, including real-service integration and browser tests as they are added. | P00-01 baseline; expands through P12-01 |
| `pnpm gen:api` | Synchronize committed OpenAPI and generated client from real schemas/controllers. | P01-02 baseline; P07-02 final |
| `pnpm openapi:check` | Generate temporary spec, lint and compare to committed output without changing it. | P07-01 |
| `pnpm client:check` | Generate temporary client and compare to committed output. | P07-02 |
| `docker compose config` | Validate the normal five-service configuration. | P00-04 |
| `docker compose up --build` | Build/start web, API, worker, PostgreSQL and Redis with meaningful readiness. | P00-04 shell; P01-05 initialization; P12-03 final |

Root package scripts delegate to `turbo run`; package scripts own execution. Checks against external services are uncached. Build caching cannot replace test evidence, and an old cached success cannot establish behavior against a newly changed database or environment.

## Endpoint completion checklist

All items must be true in the endpoint's first complete task:

- Request, path, query and response schemas are exported from contracts, with typed errors and strict fields.
- DTOs are derived through `nestjs-zod`; no separately maintained duplicate transport type.
- A stable unique operationId, success responses and relevant error responses appear in OpenAPI.
- Authentication and resource authorization are explicit; public infrastructure/auth exceptions are named and justified.
- Acting identity/tenant/role come from verified context. Any target role/workspace parameter is checked by the intended endpoint.
- Tenant repositories validate all related IDs. Mutations lock, re-read policy, validate and persist atomically.
- Tests exercise the observable success, malformed/forbidden/cross-tenant behavior and applicable domain edge cases.
- Spec and generated SDK/options match committed schema output. Web consumers use those generated operations.
- Errors preserve the documented envelope/path and avoid secrets; DTO serialization prevents accidental sensitive fields.

Before full drift scripts arrive, run the P01-02 generator and review the reproducible diff. Their later arrival never excuses missing spec/client artifacts on an earlier endpoint.

## Failure-case priorities

| Area | Minimum negative cases when that path changes |
|---|---|
| Auth | Bad password/token, expired token, missing membership, forbidden Origin, refresh replay/concurrency. |
| Tenancy | Foreign IDs in reads/writes, nested relationships, pagination, anchors, job/event references; no mutation in either tenant. |
| Permissions | Private/denied ancestor, direct URL versus tree, source and target of moves, revoked live subscription. |
| Statuses | Required category missing, hidden in-use status, inherited override preserving ID, different siblings, missing optional closed fallback. |
| Fields | Wrong type/option, required missing, unknown key, invalid date, duplicate multi-select, valid zero/false, incompatible ancestor changes. |
| Ordering and writes | Empty/edge positions, invalid anchors, stale version, simultaneous move/config writes, full rollback with no emitted event. |
| Client/UI | Aborted request, failed refresh, out-of-order response, identity/list change, optimistic rejection, dirty drawer under realtime. |
| Async/startup | Repeated first boot, failed migration, Redis outage, repeated event, crash after activity persistence but before publication. |

Do not re-run unrelated expensive suites indefinitely after the required root/task gates pass. Re-run when a subsequent edit, failure or unresolved concern invalidates their evidence. A required unavailable gate remains missing, regardless of how many other checks pass.

## Evidence outcomes

Use `pass`, `fail`, `not_run` or `not_applicable` for each check. Include the exact command or manual inspection, date, relevant environment and concise observed result.

- `pass` means the command/inspection actually completed and demonstrated its intended property.
- `fail` keeps the task incomplete until corrected and rerun.
- `not_run` states the reason and the consequence; it never means a pass.
- `not_applicable` is justified by the task scope, such as application tests for a documentation-only change. It cannot excuse a relevant security or behavior test.

Do not store credentials, tokens, cookie jars, full DB dumps or raw customer/task content in evidence. Reference test fixture IDs or sanitized summaries instead.

## Phase and release completion

At a phase exit, review the corresponding PLAN exit criterion and requirement rows. A requirement with multiple owning tasks remains unverified until all of its observable acceptance is demonstrated. Earlier phase completion does not claim future UI/realtime/release behavior.

The final release requires all in-scope product requirements verified, the full required API/frontend path passing, reproducible generated artifacts, clean Docker startup/restart and usable README/cookbook instructions. NEXT-01 is explicitly deferred; shipping it as if search works is not acceptable. If the user changes scope, record that instruction and update the matrix/decisions rather than silently dropping rows.

## Enabling automated enforcement

P00-02 provides boundary fixtures and review template; P07-01/P07-02 provide drift enforcement; P12-03 assembles CI from checks already used locally. Until then, use the actual available scripts and record missing automation accurately. CI must not substitute a mock persistence layer, filter away required failing tests or mark a skipped Docker suite green.
