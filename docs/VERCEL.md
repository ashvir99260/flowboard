# Vercel multi-service deployment

Updated 25 October 2026. **Selected application hosting target; configuration only, not a live deployment.** Flowboard deploys its web frontend and API as Vercel Services in one project. The continuously running queue consumer is a Vercel Daemon in that project. PostgreSQL remains on Neon. Redis remains an external managed dependency supplied through `REDIS_URL`; its provider and capacity have not been selected here. Railway and Render are not deployment targets.

Vercel Services are in beta on all plans, and Daemons entered public beta in October 2026. Services and daemons deploy alongside each other in one project. Vercel's published Daemons guide demonstrates production configuration but does not establish preview behavior; preview worker processing must be verified before treating a preview as end-to-end accepted. See Vercel's [Services overview](https://vercel.com/kb/guide/vercel-services), [Daemons overview](https://vercel.com/daemons), and [Daemons public beta announcement](https://vercel.com/changelog/vercel-daemons-is-now-in-public-beta).

## Topology and routing

The repository-root [`vercel.json`](../vercel.json) is the deployment entry point:

| Name            | Runtime                             | Public traffic    | Purpose                                                                                            |
| --------------- | ----------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| `web` service   | Next.js                             | `/(.*)` catch-all | Pages, browser assets, and same-origin REST proxy.                                                 |
| `api` service   | Container, `apps/api/Dockerfile`    | `/socket.io/(.*)` | Nest API and authenticated Socket.IO gateway. REST calls from web use the private service binding. |
| `worker` daemon | Container, `apps/worker/Dockerfile` | None              | BullMQ consumer; it initiates work and receives no public requests.                                |

The `web` service declares one private binding to `api`: `API_INTERNAL_URL`. The server-side REST proxy reads that injected origin at request time and forwards `/api/v1/...` to API `/v1/...`. Do not set `API_INTERNAL_URL` manually in Vercel. The browser connects to the public project origin for Socket.IO; `/socket.io/*` is routed to the API before the web catch-all. No binding to the worker is needed because it consumes Redis jobs and does not call the API.

The API container keeps the repository root as its service root because its Dockerfile uses the monorepo as the build context. The web service runs the frozen workspace install and Turbo-filtered build from that root. Shared packages are build inputs, not deployable services.

## Runtime configuration

Set these values in the Vercel project for the appropriate environments. The bound `API_INTERNAL_URL` is injected by Vercel and is intentionally absent from this list.

| Service       | Runtime settings                                                                                                                                                                                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web           | `WEB_ALLOWED_ORIGINS` with the exact public web origin; `REALTIME_PUBLIC_URL` set to that same public project origin so the browser's `/socket.io` request reaches the API rewrite.                                                                                                                                          |
| API           | Neon pooled `DATABASE_URL`; optional direct `DATABASE_URL_UNPOOLED` for migrations; external private `REDIS_URL`; a unique `AUTH_SECRET`; `AUTH_ALLOWED_ORIGINS` containing the exact web origin; `AUTH_ALLOW_INSECURE_HTTP=false`; `DEMO_SEED=false`; `API_DOCS=false` unless intentionally exposed; `NODE_ENV=production`. |
| Worker daemon | The same environment's `DATABASE_URL` and `REDIS_URL`; `NODE_ENV=production`. The worker does not run API migrations.                                                                                                                                                                                                        |

Keep database, Redis and signing credentials server-side. Use separate data and credentials for each environment. Redis queue/channel names are fixed, so a separate Redis logical database does not isolate environments. API startup applies checked-in migrations before readiness.

## Build, deployment, and current gaps

The project uses the root `vercel.json` and Vercel Services configuration. `git.deploymentEnabled=false` prevents an automatic Git deployment from bypassing the repository's deployment gate. Vercel's service binding is available to server runtime code, not build commands or middleware. Use `vercel dev` to run the services locally; Vercel does not start daemons in `vercel dev`, so run the worker separately during local development.

The repository's release workflow currently publishes independent API, web and worker images, and its legacy preview adapter still targets a standalone Vercel web preview plus external API/worker services. That adapter has not been changed to deploy this single Vercel Services project. Vercel's current daemon documentation does not clarify preview behavior; verify worker startup and queue processing on previews before claiming preview end-to-end acceptance. Keep `CD_ENABLED` off until a dedicated workflow change resolves the deployment path and preview worker behavior. A committed configuration or successful build is not evidence of a live deployment.

The Vercel project, Neon database, Redis instance, secrets and a live end-to-end deployment have not been provisioned or verified by this change. The Redis provider, preview processing design, and any paid capacity remain open choices. Four-environment immutable-artifact promotion is a separate future task; Vercel's source build does not prove that promotion contract. See [delivery operations](DELIVERY_OPERATIONS.md), [CI/CD](CI_CD.md), [independent releases](DELIVERY.md), and [promotion limitations](PROMOTION.md).
