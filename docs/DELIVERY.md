# Independent releases and deployment

Status: implementation plan, 23 October 2026. Docker and release automation are introduced by P00-04 through P00-06. This document does not claim a hosted deployment exists.

## Release contract

Merging to `main` releases only affected applications. Versions are independent: `api/v0.1.0`, `web/v0.1.0`, and `worker/v0.1.0`. Their container repositories are `ghcr.io/<owner>/flowboard-api`, `flowboard-web`, and `flowboard-worker`. Private workspace package versions are not production release versions; tags and GitHub Releases are authoritative.

| Change                                        | Applications considered for release                    |
| --------------------------------------------- | ------------------------------------------------------ |
| API implementation                            | API                                                    |
| Web implementation                            | Web                                                    |
| Worker implementation                         | Worker                                                 |
| Database package                              | API and worker                                         |
| UI or generated API client                    | Web                                                    |
| Contracts                                     | Every dependent application                            |
| Application dependency/lockfile update        | Applications whose resolved dependency closure changes |
| Shared compiler or common image input         | Applications whose build inputs change                 |
| Documentation, tests, lint-only configuration | None                                                   |

Walk the workspace graph, rather than treating every shared file as affecting every application. In particular, the API's future spec-export build edge must not release the web for an internal backend change. A changed generated client is an actual web input.

For each application, compare against its last published application release. Failed, cancelled or skipped workflow runs must not lose changes. The first publication starts at `0.1.0`; after that, the highest relevant Conventional Commit determines the bump: breaking change → major, feature → minor, other shipped change → patch. Documentation-only commits produce no release. Commit scopes help explain intent; changed files determine ownership.

Publication is serialized. A retry reuses an existing application/source-SHA publication and repairs unfinished work; it does not allocate a second version. Reject conflicting existing tags and stale/diverged release histories. Never move a published tag. Image publication and GitHub Release creation stay in one workflow because events created with `GITHUB_TOKEN` do not start ordinary downstream release workflows.

Build and test before publication. Releases record the source SHA and container digest, with both version and commit image tags. Production database credentials are unnecessary for building images or publishing releases. CI gets only the permissions needed for its job; pull-request validation cannot publish.

## Containers and local development

Each application has its own multi-stage Dockerfile, pruned with `turbo prune --docker`, and runs as a non-root user. API and worker images contain deployed production dependencies; web uses Next standalone output. Docker Compose runs web, API, worker, PostgreSQL and Redis with health-gated dependencies and persistent local data volumes.

The current API/worker shells provide process liveness. Database-aware readiness arrives in P01-02 and initialization in P01-05. Do not add dummy successful health endpoints or a fake migration step. Image builds require no database, Redis or cloud credentials.

Local PostgreSQL stays in Docker. A localhost-only port override supports running Node development servers on the host. Hosted PostgreSQL uses Neon: pooled `DATABASE_URL` for application traffic and direct `DATABASE_URL_UNPOOLED` for migrations. Both remain server-side environment variables. Seed data is opt-in for a hosted environment and must never be applied implicitly to production.

## Hosted hobby target

Selected by the user: Vercel Hobby for Next.js, Northflank Sandbox for the API and worker, Northflank Redis, and Neon PostgreSQL. These are separate deployment targets, so releasing one application does not deploy the others. Keep Redis private, enable persistence, and use `noeviction` for BullMQ.

Northflank currently offers two always-on services and one database addon, which fits API + worker + Redis. Its Sandbox is intended for hobby/testing use; it is not a production SLA. Vercel Hobby is for personal, noncommercial use. Free-tier capacity and account eligibility must be checked before provisioning; no paid plan is enabled by this repository.

Neon can suspend idle compute. Future outbox polling must use deliberate backoff/wakeup behavior, and liveness checks should not issue frequent database queries that keep it awake. PostgreSQL remains authoritative; no migration or validation policy changes because the host is Neon.

Provider configuration and credentials are separate from releases. This work does not create accounts, allocate hosted resources, or claim a running cloud deployment. Record URLs and required secret names when the chosen host is connected; never commit their values.

## Sources checked on 23 October 2026

- [Turborepo Docker pruning](https://turborepo.dev/docs/guides/tools/docker)
- [Next standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [GitHub container publication](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
- [GitHub workflow triggering](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [Northflank pricing](https://northflank.com/pricing)
- [Northflank Redis](https://northflank.com/docs/v1/application/databases-and-persistence/deploy-databases-on-northflank/deploy-redis-on-northflank)
- [Neon with Prisma](https://neon.com/docs/guides/prisma)
- [BullMQ production guidance](https://docs.bullmq.io/guide/going-to-production)

## Inspecting a release plan

`packages/release-tools` reads committed Git trees, never uncommitted changes. Save the successful GitHub Release tag names as a JSON array and run:

```sh
pnpm release:plan -- --published-tags /absolute/path/published-tags.json
```

Use `[]` only for a repository that has never published. Local Git tags alone are not evidence of completed publication. Fetch all history and tags first. The output contains the affected app, source SHA, version, tag, prior release and whether an unfinished tag can resume. The workflow supplies the authoritative published list automatically.

The planner compares runtime dependencies recursively on both snapshots, including peer-qualified/transitive lock entries and integrity metadata. Shared TypeScript configuration and TypeScript/type build dependencies count as artifact inputs; development servers, lint and test tools do not. Build/start commands, package exports, Docker inputs and source file modes count. When adding a different compiler/code generator to the build, add its build dependency to the planner and a behavioral fixture. Markdown documentation, environment examples and test files are excluded; `public/**` assets always participate. Runtime content outside `public` should live outside documentation/test conventions. A valid final PR may contain intermediate commits with incomplete dependency locks; those commits are classified using runtime ownership at the valid release endpoints.

A completely reverted change causes no publication. Breaking changes in another app do not inflate this app's version. A pending tag at an older source must be completed by retrying that workflow before newer publication; unexpected versions or rewritten histories stop with an actionable error.
