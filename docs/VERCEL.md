# Vercel Hobby deployment

Updated 26 October 2026. The target is one Vercel Hobby project containing the Next.js web service, NestJS API container service and BullMQ worker daemon. PostgreSQL uses the existing Neon Free project; Redis uses Upstash Free over TLS. Configuration and automated provider tests do not establish a live deployment: P38-03 records that separately.

## Deployment target and routing

Vercel [Services](https://vercel.com/docs/services) and [Daemons](https://vercel.com/docs/daemons) are available on Hobby. Daemons currently run **only in production deployments**, so the shared demo uses Vercel's production target. It remains a hobby/demo environment with separate credentials; a preview deployment cannot prove activity processing.

| Component  | Configuration                              | Traffic                                                                |
| ---------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| web        | Next.js service rooted at apps/web         | Public catch-all, pages and same-origin REST proxy                     |
| api        | Container service using Dockerfile.api     | Private API binding; public /socket.io/*                               |
| worker     | One daemon using Dockerfile.worker in iad1 | No public route; consumes Redis jobs and dispatches committed events   |
| PostgreSQL | Neon Free                                  | Server-only pooled connection; direct connection for migrations        |
| Redis      | Upstash Free                               | Server-only rediss:// connection for BullMQ, rate limiting and pub/sub |

The root [vercel.json](../vercel.json) owns this topology. The worker requests the minimum supported 1 GiB rather than inheriting Vercel's 2 GiB default. Web receives API_INTERNAL_URL through its private service binding; do not manually replace it with a public or loopback address. The proxy forwards /api/v1 to API /v1. Socket.IO uses the public project origin and WebSocket transport through the /socket.io rewrite. Auth, permission checks and domain logic remain in the API.

Vercel's container build uses the Dockerfile's directory as its build context. [Dockerfile.api](../Dockerfile.api) and [Dockerfile.worker](../Dockerfile.worker) therefore live at the repository root, each pruning and packaging only its own production workspace dependencies. These same files serve Compose and independent image publication, without duplicated build definitions. A nested app Dockerfile would omit the root workspace manifest and packages even with the service `root` set to `.`. Both use literal filenames because the live builders reject the documented `#stage` suffix. The web Dockerfile remains in `apps/web` because its Vercel service uses the native Next.js builder.

Normal API bootstrap must not poll for outbox events after responding: Vercel functions may suspend or stop. P38-04 moves that existing delivery loop into the worker daemon, sharing its implementation through the jobs package. PostgreSQL remains authoritative for event references, claims and completion.

## Runtime settings

Set these as production environment variables in the dedicated Vercel project. Secrets must never be checked in, logged or substituted into browser bundles.

| Setting                  | Value or purpose                                                              |
| ------------------------ | ----------------------------------------------------------------------------- |
| DATABASE_URL             | Neon pooled PostgreSQL URL, including required TLS parameters                 |
| DATABASE_URL_UNPOOLED    | Neon direct PostgreSQL URL for the API's migration lock and Prisma migrations |
| REDIS_URL                | Upstash TCP Redis URL using rediss://; a REST URL/token is not a replacement  |
| AUTH_SECRET              | Unique cryptographically random signing secret                                |
| AUTH_ALLOWED_ORIGINS     | Exact HTTPS origin of the deployed demo                                       |
| WEB_ALLOWED_ORIGINS      | The same exact HTTPS demo origin                                              |
| REALTIME_PUBLIC_URL      | The same HTTPS project origin; never the private API binding                  |
| AUTH_ALLOW_INSECURE_HTTP | false                                                                         |
| DEMO_SEED                | false; create your own account through signup                                 |
| API_DOCS                 | false unless deliberately exposing the API documentation                      |
| NODE_ENV                 | production                                                                    |
| HOST                     | 0.0.0.0; container listener                                                   |
| PORT                     | 3001; Vercel container routing and API listener must agree                    |
| API_INTERNAL_URL         | Automatically injected service binding; do not configure manually             |

The API runs checked-in migrations before readiness; the worker does not own migrations. A deployment is not accepted until the API is reachable, schema initialization has finished and an actual task change produces activity through the worker. Use isolated environment data and secrets; fixed Redis queue/channel names cannot be isolated with a logical database number alone.

## Free-tier boundaries

This is a bounded demo, not a promise of unlimited or continuously free operation.

- [Upstash Free](https://upstash.com/pricing/redis) currently includes 250 MB, 10 GB monthly bandwidth and 500,000 monthly commands in the provisioned dashboard. BullMQ and live connections consume commands even when no task is edited. Keep the free plan; never enable pay-as-you-go or auto-upgrade silently.
- [Neon Free](https://neon.com/blog/neon-free-plan-1-gb-per-project) includes 100 CU-hours per project per month. Constant polling keeps the database active: 0.25 CU for 30 days is about 180 CU-hours, above that quota. Pause the demo daemon when not needed and monitor usage. An adaptive idle/wake design is separate work; this deployment does not claim to implement it.
- [Vercel Daemons](https://vercel.com/docs/daemons/limits) and [Functions](https://vercel.com/docs/plans/hobby) have separate resource quotas. Use one worker instance and the Hobby plan. Exceeding a free quota can stop service; it is not permission to upgrade.

## One-project deployment and CI

P38-02 replaces the older Vercel/Northflank adapter with one Vercel deployment from the validated current main SHA after app publication. Independent app tags and image manifests remain unchanged. The deployment uses the production target so the daemon can run; it validates the configured Hobby team, project, linked repository and production environment-key names. The deployment details request opts into Git metadata, then verifies the exact source, web/API service inventory and ready function builds. A separate production daemon inventory must report one ready, live worker in `iad1` belonging to that same deployment. Retries reuse the same deployment identity. These provider checks establish rollout readiness; application behavior still requires the live acceptance below.

GitHub runs the existing parallel verification lanes, then publishes affected apps. The deployment job uses the protected demo environment and remains gated by CD_ENABLED. Configure VERCEL_TOKEN as an environment secret, and VERCEL_PROJECT_ID and VERCEL_TEAM_ID as environment variables. The root command is pnpm deploy:vercel. Database and Redis credentials belong in Vercel, not GitHub deployment logs.

Keep automatic Git deployment disabled in vercel.json so pushes cannot bypass the checks/publication gate. Initial manual provisioning and a tested deployment must happen before CD_ENABLED is enabled. No paid plan, resource, billing upgrade, production-data migration or secret transmission is inferred from the presence of this file.

## Live acceptance

P38-03 must record the deployment URL and source identity, Hobby plan, real web/API/worker readiness, signup/login/refresh, an authorized task edit, worker-written activity and cross-client realtime delivery. Check quota dashboards and record any provider failures accurately. Vercel READY alone does not prove the worker processed a job.

Vercel builds these services from source. This does not satisfy the future unchanged-artifact dev → qa → stage → prod contract. See [promotion](PROMOTION.md), [CI/CD](CI_CD.md) and [independent releases](DELIVERY.md).

## Neon configuration and native service verification

`neon.ts` enables the existing Postgres service while keeping NestJS authentication. The repository uses Prisma with its `pg` adapter: keep the pooled `DATABASE_URL` for API/worker requests and `DATABASE_URL_UNPOOLED` for the migration connection. No browser code receives either variable. `@neon/config` and `@neon/env` are exact-version development dependencies for the Neon CLI configuration.

The requested project is `solitary-thunder-02260917`, organization `org-plain-haze-17394215`, branch `production`. After `neon login`, connect or refresh it with:

```sh
neon init -y --no-agent-setup --org-id org-plain-haze-17394215 --project-id solitary-thunder-02260917 --branch production --services postgres
neon deploy
```

The installed Neon skills supply agent guidance. `.neon`, `.env`, `.env.local` and `.vercel` remain local and ignored. The CLI pulls into the existing root `.env`; keep `DEMO_SEED=false` for hosted data and configure `REDIS_URL` using Upstash's TLS TCP connection. Never paste credentials into committed examples.

After `npm run build`, these native commands explicitly inherit that root environment. Run each in a separate terminal from the repository root, starting the API first so migrations finish before the worker:

```sh
HOST=localhost PORT=3401 AUTH_ALLOWED_ORIGINS=http://localhost:3400,http://localhost:3401 AUTH_ALLOW_INSECURE_HTTP=true node --env-file=.env apps/api/dist/main.js
HOST=localhost PORT=3402 node --env-file=.env apps/worker/dist/main.js
HOSTNAME=localhost PORT=3400 API_INTERNAL_URL=http://localhost:3401 WEB_ALLOWED_ORIGINS=http://localhost:3400 REALTIME_PUBLIC_URL=http://localhost:3401 node --env-file=.env apps/web/.next/standalone/apps/web/server.js
```

Open `http://localhost:3400` and create a new account. These explicit commands verify hosted services; ordinary `pnpm dev` retains the existing per-app local development environment. Production uses HTTPS, secure cookies and the exact stable Vercel alias for allowed origins and realtime. An immutable deployment URL is not automatically allowlisted.
