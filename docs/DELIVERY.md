# Independent releases and deployment

**Future promotion direction:** Docker is for local development/test. The user may adopt trunk-based `dev → qa → stage → prod` delivery with one unchanged artifact and runtime configuration. Current Vercel source deployment does not meet that build-once contract; see [PROMOTION.md](PROMOTION.md) before enabling hosted CD for that purpose.

Status: Docker and release automation implemented by P00-04 through P00-06, 23 October 2026. The first real main-branch publication is tracked by P00-07. This document does not claim a hosted deployment exists.

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

## Initial hosted preview

Selected by the user: Vercel Hobby for Next.js, Northflank Sandbox for the API and worker, Northflank Redis, and Neon PostgreSQL. Use one shared preview stack initially. These are separate deployment targets, so releasing one application does not deploy the others. A separate stack per pull request is outside the free allocation. Keep Redis private, enable persistence, and use `noeviction` for BullMQ.

Northflank currently offers two always-on services and one database addon, which fits API + worker + Redis. Its Sandbox is intended for hobby/testing use; it is not a production SLA. Northflank requires a payment method before resource creation, including free Sandbox resources; keep the free allocation selected and do not enable a paid plan. Vercel Hobby is for personal, noncommercial use. Free-tier capacity and account eligibility must be checked before provisioning; no paid plan is enabled by this repository.

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

## GitHub release setup and recovery

The `Verify, release and deploy applications` workflow validates pull requests with read-only repository access. On `main`, it also builds the Compose stack and then enters a serialized publisher. Only that job receives `contents: write` and `packages: write`; it uses GitHub's built-in token, so no personal access token or cloud secret is required.

For each affected app it publishes `ghcr.io/<owner>/flowboard-<app>:<version>` and `:sha-<full-commit>`, creates the application tag, uploads `release.json` to a draft release, and publishes the draft. The manifest records app, version, source SHA, image repository and digest. Images target `linux/amd64`. The first successful main run releases each app as `0.1.0`; later runs compare each app's own published baseline. Protected tag/ruleset policies must permit this workflow to create `api/v*`, `web/v*` and `worker/v*` tags.

Existing image tags are reused only when digest and source/version labels match. Conflicting image tags are never overwritten. An interrupted upload leaves an unpublished draft; retry the failed workflow at the same SHA to finish it. A completed release is skipped. If a newer run finds an older unfinished tag, finish the older run first, then rerun the newer one. Do not delete/move release tags or edit manifests to bypass a conflict. A rewritten/diverged main history needs deliberate recovery, not an automatic version reset.

Enable GitHub Actions and package publication for the repository, and require the verification jobs in branch protection. The workflow starts after this change is merged into main; a local passing run is not proof of a remote publication. If GHCR packages are private, give the host a read-only registry credential, or explicitly change the package visibility to public for this public hobby app. Public image contents must never contain secrets.

## Vercel UI setup

1. Use a dedicated Vercel Hobby project named `flowboard-preview`, never a real production project. Vercel's [first deployment is always production](https://vercel.com/docs/deployments/environments#first-deployment), including preview requests. An empty project therefore needs an explicitly reviewed one-time bootstrap of this real foundation app before preview CI is enabled. That deployment is production-labeled only within this preview-only project; use no production data, secrets or custom domains. CI refuses to perform this bootstrap automatically. Import this GitHub repository into that project. Use **Next.js**, root directory `apps/web`, and Node **22.x**. Enable access to source files outside the root directory so workspace packages are available.
2. Install command: `cd ../.. && pnpm install --frozen-lockfile`. Build command: `cd ../.. && pnpm build --filter=@flowboard/web`. Keep Next's `.next` output setting. The app package and its dependency builds stay owned by Turbo.
3. `apps/web/vercel.json` disables automatic Git deployments. The gated GitHub CD job selects released web versions and deploys their exact commits after checks pass. Keep this setting so provider Git events cannot bypass the pipeline.
4. The CI source branch is `main`, but the deployment API creates a Vercel **preview**, without production promotion. Add a public API origin only when P07-03 implements the generated client's configuration. Database, Redis, signing and refresh secrets never belong in Vercel browser variables.

After the explicit initial bootstrap, Vercel builds the exact released Git commit as a preview; the web Docker image remains an independently versioned portable artifact. GitHub Releases and provider deployments are separate records. Follow [preview CI/CD activation](CI_CD.md) to connect tokens and enable the `preview` job.

## Northflank API, worker and Redis setup

1. Create one Sandbox project named `flowboard-preview` in an available region. Confirm its free allocation first, then select the same region for Neon. Add the Redis addon on the free allocation; keep its endpoint private, enable persistence, and set `maxmemory-policy=noeviction` for BullMQ.
2. Create two services from external GHCR images: `flowboard-api:<version>` and `flowboard-worker:<version>` from the respective releases. Prefer the immutable digest from `release.json` for deployment/rollback. Do not build all apps in one service.
3. API: `HOST=0.0.0.0`, `PORT=3001`; expose HTTP port 3001 with TLS and WebSocket support. Worker: background service, `PORT=3002`, TCP liveness on 3002, with no public ingress. Use the image defaults for commands.
4. Set the server-only variables below through host secrets. Use the same Redis service for API sockets and worker queues. Keep worker and Redis in the same project/region.
5. Follow [CI/CD activation](CI_CD.md) to enable independent digest-based deployment from GitHub. Keep Northflank automatic image updates disabled; the pipeline pins the published digest and checks readiness. No cloud account is linked by this change.

| Variable                | API                   | Worker      | Purpose                                                 |
| ----------------------- | --------------------- | ----------- | ------------------------------------------------------- |
| `DATABASE_URL`          | yes                   | yes         | Neon pooled application URL; preserve Neon TLS settings |
| `DATABASE_URL_UNPOOLED` | migration runner only | no          | Neon direct URL for migrations                          |
| `REDIS_URL`             | yes                   | yes         | Private addon connection string                         |
| `HOST`, `PORT`          | `0.0.0.0`, `3001`     | port `3002` | Service binding/liveness                                |

The current services are foundation shells. Database-aware readiness arrives in P01-02, migrations/seed in P01-05, auth settings in P02, and real queues in P11-02. These are tracked tasks, not working hosted product features. When auth arrives, explicitly allow the Vercel origin and configure secure cross-origin refresh cookies; do not use wildcard credentialed CORS.

## Neon preview setup

Create a dedicated `flowboard-preview` Neon project/database in a region close to the Northflank API. Confirm Northflank availability first because both region choices are fixed at creation. For example, pair Asia Southeast with Neon AWS Singapore (`aws-ap-southeast-1`) or Frankfurt with `aws-eu-central-1`. Copy its **pooled** connection URL into the API/worker `DATABASE_URL` secret, and its **direct** URL into the migration runner's `DATABASE_URL_UNPOOLED` secret. Never commit either value. Keep the SSL parameters supplied by Neon. In P01-05, migrations will run as a controlled pre-deploy job with the direct URL; hosted demo seeding stays opt-in. Local Compose continues using PostgreSQL with local-only credentials.

Free plans have capacity limits and may change. Northflank Sandbox currently fits the two services and one Redis addon; Vercel Hobby is limited to personal/noncommercial projects. Neon idle suspension can add cold-start latency. Avoid frequent database polling/health queries that keep compute awake, and check current provider quotas before creating resources.
