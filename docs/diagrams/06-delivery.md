# CI and independent releases

[Atlas index](../DIAGRAMS.md). Original baseline: `cc0e3d6`; deployment review: `507a0a8`, 26 October 2026. Render details are in the [diagram guide](README.md).

## C23 — Trunk and review flow

**Status: Operating model.** This is the documented operating model. CI runs today; branch protection and merge policy are repository settings that must be configured and verified separately.

![Trunk and review flow. Operating model.](svg/c23-trunk-and-review-flow.svg)

[Editable Mermaid source](sources/c23-trunk-and-review-flow.mmd). References: [Trunk-based guide](../DELIVERY_OPERATIONS.md#trunk-based-development-in-flowboard), [Workflow](../DEVELOPMENT_WORKFLOW.md).

## C24 — Eight CI lanes and release gates

**Status: Implemented.** Five workspace checks, UI tests and two Compose checks start independently. Main publication targets GHCR; protected settings gate the temporary Vercel source deployment.

![Eight CI lanes and release gates. Implemented.](svg/c24-seven-ci-lanes-and-release-gates.svg)

[Editable Mermaid source](sources/c24-seven-ci-lanes-and-release-gates.mmd). References: [GitHub workflow](../../.github/workflows/delivery.yml), [CI details](../CI_CD.md).

## C25 — Independent release decision

**Status: Implemented.** The first published version initializes at 0.1.0. Later release ownership comes from files and dependency fingerprints, not just commit scope text. Complete reverts can produce no release; changing API internals alone need not release the browser.

![Independent release decision. Implemented.](svg/c25-independent-release-decision.svg)

[Editable Mermaid source](sources/c25-independent-release-decision.mmd). References: [Release planner](../../packages/release-tools/src/index.ts), [Release examples](../DELIVERY_OPERATIONS.md#how-independent-releases-work).

## C26 — Publication identity and retry

**Status: Implemented.** Publication checks its committed source and per-app history. It may publish an earlier queued main commit; the deployment layer separately rejects stale workflow-main identities.

![Publication identity and retry. Implemented.](svg/c26-publication-identity-and-retry.svg)

[Editable Mermaid source](sources/c26-publication-identity-and-retry.mmd). References: [Publisher](../../packages/release-tools/src/publisher.ts), [Image publication](../../packages/release-tools/src/images.ts).

## C27 — One image with different runtime configuration

**Status: Runtime seams implemented; ECR and promotion planned.** Runtime configuration seams and current GHCR publication exist. ECR integration and ordered unchanged-image promotion remain planned, with isolated data and Redis per environment.

![One image with different runtime configuration. Runtime seams implemented; ECR and promotion planned.](svg/c27-one-image-with-different-runtime-configuration.svg)

[Editable Mermaid source](sources/c27-one-image-with-different-runtime-configuration.mmd). References: [Runtime injection](../DELIVERY_OPERATIONS.md#where-environment-settings-enter), [Promotion contract](../PROMOTION.md).
