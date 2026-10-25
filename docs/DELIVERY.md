# Independent releases and deployment

> Updated 26 October 2026: [Vercel Services](VERCEL.md) hosts the shared Hobby demo with Neon Free and Upstash Free. Independent tags/images remain as described below; one gated deployment builds the validated current main source for all services. This is not unchanged-artifact promotion. Keep CD_ENABLED off until live acceptance.

**Future promotion direction:** Docker is for local development/test. Trunk-based `dev → qa → stage → prod` delivery with one unchanged artifact and runtime configuration remains future work. Vercel Services configuration does not by itself meet that build-once contract; see [PROMOTION.md](PROMOTION.md).

Status: Docker and release automation are implemented; P12-03 verifies the complete local MVP and both container modes, 24 October 2026. The first real main-branch publication is tracked by P00-07. This document does not claim a hosted deployment exists.

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

Walk the workspace graph, rather than treating every shared file as affecting every application. In particular, the API's build-only spec-export edge must not release the web for an internal backend change. A changed generated client is an actual web input.

For each application, compare against its last published application release. Failed, cancelled or skipped workflow runs must not lose changes. The first publication starts at `0.1.0`; after that, the highest relevant Conventional Commit determines the bump: breaking change → major, feature → minor, other shipped change → patch. Documentation-only commits produce no release. Commit scopes help explain intent; changed files determine ownership.

Publication is serialized. A retry reuses an existing application/source-SHA publication and repairs unfinished work; it does not allocate a second version. Reject conflicting existing tags and stale/diverged release histories. Never move a published tag. Image publication and GitHub Release creation stay in one workflow because events created with `GITHUB_TOKEN` do not start ordinary downstream release workflows.

Build and test before publication. Releases record the source SHA and container digest, with both version and commit image tags. Production database credentials are unnecessary for building images or publishing releases. CI gets only the permissions needed for its job; pull-request validation cannot publish.

## Containers and local development

Each application has its own multi-stage Dockerfile, pruned with `turbo prune --docker`, and runs as a non-root user. API and worker images contain deployed production dependencies; web uses Next standalone output. Docker Compose runs web, API, worker, PostgreSQL and Redis with health-gated dependencies and persistent local data volumes.

API and worker expose HTTP liveness at `/health/live` and dependency-aware readiness at `/health/ready`. The API applies checked-in migrations and optional demo initialization before serving requests; the worker consumes durable activity jobs. Image builds require no database, Redis or cloud credentials. P12-03 verifies startup, restart persistence, dependency failure and recovery.

Local PostgreSQL stays in Docker. A localhost-only port override supports running Node development servers on the host. Hosted PostgreSQL uses Neon: pooled `DATABASE_URL` for application traffic and direct `DATABASE_URL_UNPOOLED` for migrations. Both remain server-side environment variables. Seed data is opt-in for a hosted environment and must never be applied implicitly to production.

## Hosted services

Use [Vercel Services](VERCEL.md) for the selected web/API/worker topology and [Neon preview setup](#neon-preview-setup) for the hosted database. Redis is an external managed dependency; its provider, capacity and environment isolation remain to be selected. Railway and Render are not deployment targets. No provider resource, secret or paid capacity has been provisioned by this repository change.

Neon can suspend idle compute. The API outbox dispatcher polls PostgreSQL, and readiness checks query dependencies; this traffic may keep compute awake. Liveness is dependency-independent. Assess polling and health-check frequency against actual hosted usage before claiming idle suspension or free-tier suitability. PostgreSQL remains authoritative; no migration or validation policy changes because the host is Neon.

Provider configuration and credentials are separate from releases. This work does not create accounts, allocate hosted resources, or claim a running cloud deployment. Record URLs and required secret names when the chosen host is connected; never commit their values.

## Sources checked on 23 October 2026

- [Turborepo Docker pruning](https://turborepo.dev/docs/guides/tools/docker)
- [Next standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [GitHub container publication](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
- [GitHub workflow triggering](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [Vercel Services](https://vercel.com/docs/services)
- [Vercel Daemons](https://vercel.com/docs/daemons)
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

## GitHub release setup and recovery

The `Verify, release and deploy applications` workflow validates pull requests with read-only repository access. On `main`, it also builds the Compose stack and then enters a serialized publisher. Only that job receives `contents: write` and `packages: write`; it uses GitHub's built-in token, so no personal access token or cloud secret is required.

For each affected app it publishes `ghcr.io/<owner>/flowboard-<app>:<version>` and `:sha-<full-commit>`, creates the application tag, uploads `release.json` to a draft release, and publishes the draft. The manifest records app, version, source SHA, image repository and digest. Images target `linux/amd64`. The first successful main run releases each app as `0.1.0`; later runs compare each app's own published baseline. Protected tag/ruleset policies must permit this workflow to create `api/v*`, `web/v*` and `worker/v*` tags.

Existing image tags are reused only when digest and source/version labels match. Conflicting image tags are never overwritten. An interrupted upload leaves an unpublished draft; retry the failed workflow at the same SHA to finish it. A completed release is skipped. If a newer run finds an older unfinished tag, finish the older run first, then rerun the newer one. Do not delete/move release tags or edit manifests to bypass a conflict. A rewritten/diverged main history needs deliberate recovery, not an automatic version reset.

Enable GitHub Actions and package publication for the repository, and require the verification jobs in branch protection. The workflow starts after this change is merged into main; a local passing run is not proof of a remote publication. If GHCR packages are private, give the host a read-only registry credential, or explicitly change the package visibility to public for this public hobby app. Public image contents must never contain secrets.

See [Vercel multi-service deployment](VERCEL.md) for project configuration, service bindings, route exposure and runtime settings. The local MVP includes authentication, tenant-scoped tasks, realtime updates and durable activity processing. Hosted acceptance remains open until the Vercel project and external dependencies are deployed and exercised.

## Neon preview setup

Create a dedicated preview Neon project/database in a region compatible with the Vercel deployment. Copy its **pooled** connection URL into the API/worker `DATABASE_URL` secret, and its **direct** URL into the API's `DATABASE_URL_UNPOOLED` secret. Never commit either value. Keep the SSL parameters supplied by Neon. API startup runs the checked-in migrations through database initialization, using the direct URL when supplied, before accepting requests; hosted demo seeding stays opt-in. Local Compose continues using PostgreSQL with local-only credentials.

Vercel Services and Daemons have platform limits that can change; check the official documentation before provisioning. Neon idle suspension can add cold-start latency. Avoid frequent database polling/health queries that keep compute awake, and check current provider quotas before creating resources.
