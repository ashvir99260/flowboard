# Build once, promote unchanged

Status: D171 selects Docker images stored in ECR for future production. Four-environment execution and ECR integration are planned, not implemented. Deploying the same Git commit is not sufficient proof of artifact promotion. [Run modes](RUN_AND_DEPLOY.md) defines development, local preview, temporary demo and production separately.

## Shared demo comes first

The current temporary demo uses [Vercel Services](VERCEL.md), Neon and Upstash. It is separate from the long-term Docker/ECR production target. Vercel builds from repository source and does not satisfy the unchanged-artifact contract. Its technical production target enables the worker daemon; that platform label does not redefine Flowboard's future production architecture. [Delivery operations](DELIVERY_OPERATIONS.md) connects this contract to the actual release/runtime code.

## What stays separate

Full Docker Compose is the local preview/test environment. Everyday development runs web/API/worker through `pnpm run dev` with only PostgreSQL and Redis in Docker. Future hosted environments run the selected immutable Docker images from ECR. The AWS application runtime is not yet selected; ECR is the image registry, not a container scheduler.

The target trunk-based development model means one `main` trunk and short-lived feature branches. `dev`, `qa`, `stage` and `prod` are deployment targets, not long-lived source branches. Their configuration and approval rules do not create new application versions.

```mermaid
flowchart LR
  PR[Short-lived branch / PR checks] --> Main[main]
  Main --> Build[Build release candidate once]
  Build --> Artifact[Docker image in ECR + digest + source manifest: planned]
  Artifact --> Dev[dev: runtime configuration]
  Dev --> QA[qa: same digest + runtime configuration]
  QA --> Stage[stage: same digest + runtime configuration]
  Stage --> Prod[prod: same digest + runtime configuration]
```

## Artifact contract

- Build each changed application once for a release candidate. Preserve its version, source SHA, dependency lock and artifact SHA-256/digest. Independent API/web/worker versions remain supported.
- Test the candidate artifact itself before promotion. PR builds are disposable validation builds; they are not promoted release candidates.
- Promotion takes an explicit existing release/artifact reference. It never runs `next build`, TypeScript compilation, dependency installation, image building or a source-based deployment endpoint.
- Deploy exactly the same bytes in every target. A Git SHA, mutable `latest` tag or environment-specific rebuild is not proof of artifact identity.
- Record application version, artifact digest, environment, configuration revision and deployment result. Moving to another environment does not mint a new application tag.
- Advance only after the preceding environment's acceptance checks pass for that same artifact. Approval policy is configurable; staging/production can require approval without changing the artifact.
- Promote explicitly selected candidates rather than whichever release happens to be newest. A new trunk commit must not silently replace a candidate that is progressing through QA/staging.
- Serialize changes within an environment. Reject conflicting or stale promotion attempts. A rollback selects a previously verified artifact; database compatibility must be considered separately.

## Runtime configuration

| Concern               | Contract                                                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node execution mode   | `NODE_ENV=production` for every hosted target; do not set it to `qa` or `stage`                                                                                                        |
| Environment identity  | A future `APP_ENV` label may name dev/qa/stage/prod; current application code does not consume this selector. Provider service/configuration identity identifies the environment today |
| Server settings       | Load and validate database/Redis URLs, auth settings and service origins when the process starts; inject through the host's runtime configuration/secrets                              |
| Browser settings      | Serve only a typed, explicitly allowed public configuration from dynamic Next.js server rendering/bootstrap; initialize the generated client from that configuration                   |
| Browser secrets       | Never expose database URLs, Redis credentials, signing keys or provider tokens                                                                                                         |
| Build inputs          | No environment-specific API origins, feature flags or secrets baked into client bundles or static HTML                                                                                 |
| Next.js restrictions  | Do not use `NEXT_PUBLIC_*` or `next.config` `env` for values that differ between deployment targets; those are build-time substitutions                                                |
| Caching               | Public runtime bootstrap/config must not be statically prerendered or shared between environments; immutable JS/CSS can keep long-lived caching                                        |
| Configuration changes | Restart/redeploy the same artifact with new runtime settings; no source edit or rebuild                                                                                                |

Use shared schemas and a narrow public configuration type. Read server values at startup or a deliberately dynamic request boundary; merely moving a value to `process.env` is insufficient if the route is prerendered during build. Do not rewrite compiled bundles with search-and-replace at container startup.

Each environment needs isolated database data and a separate Redis instance. Current fixed queue/channel/auth namespaces are not configurable; a Redis logical database alone does not isolate Pub/Sub. Neon remains the hosted PostgreSQL choice; separate projects/branches/databases and credentials must be chosen when environments are provisioned. Migrations are an environment-specific deployment step using backward-compatible changes, not part of artifact rebuilding. Demo seed data must remain excluded from production.

## Current implementation versus this target

| Current component                                   | Compatibility                                                                                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local Compose and per-app Dockerfiles               | Full local preview and the Docker artifact foundation for future ECR production                                                                                           |
| Independent release tags and digest manifests       | Reuse as the foundation                                                                                                                                                   |
| Existing Northflank API/worker deployment by digest | Historical provider path; not the selected deployment topology                                                                                                            |
| Vercel Services deployment from source              | Builds the source for the deployment; **does not satisfy build-once promotion**                                                                                           |
| Gated one-project Vercel source deployment          | Does not implement ordered four-environment promotion of an explicitly selected candidate                                                                                 |
| Public runtime bootstrap                            | REST uses the runtime-only server proxy (P07-04); validated `REALTIME_PUBLIC_URL` is read at server request time for Socket.IO (P11-03). Full promotion remains separate. |

The current `CD_ENABLED=true` gate enables only the configured Vercel Hobby Services deployment after verification and GHCR publication. P38-03 verifies a manual live demo; protected main-branch CD activation remains separate. The gate does not provision credentials or implement the four-environment contract. P00-08/P00-13 describe superseded provider paths; P38-02 implements the current one-project adapter.

## Selected hosting path

The temporary Vercel demo is documented in [VERCEL.md](VERCEL.md). Current image publication uses GHCR. P39-02 will integrate ECR; P00-11/P00-12 retain promotion gates and live same-digest acceptance. No ECR repository, IAM role or AWS application runtime is claimed as configured.

## Acceptance proof for the future implementation

Build a candidate once, disable compilation and dependency downloads during promotion, and deploy it to two isolated target configurations. Artifact registry access, provider deployment APIs and runtime test traffic remain allowed. Assert identical artifact hashes, different allowed runtime settings, no secret in browser assets, no configuration leakage through caches, and successful rejection of invalid/missing settings. Extend the same proof to `dev → qa → stage → prod`, approvals, failed promotion/retry, and rollback. Record the exact tested candidate in deployment evidence.

## References

- [Next.js self-hosting and runtime environment variables](https://nextjs.org/docs/app/guides/self-hosting)
- [Next.js environment variables and build-time public substitution](https://nextjs.org/docs/app/guides/environment-variables)
- [Vercel build targets](https://vercel.com/docs/cli/build)
- [Vercel prebuilt deployment](https://vercel.com/docs/cli/deploy#prebuilt)
- [Vercel environment and promotion behavior](https://vercel.com/docs/deployments/promoting-a-deployment)

Vercel Services and daemon limits are documented in the [Vercel deployment guide](VERCEL.md). The Vercel references above explain why source builds are not the future build-once promotion path.
