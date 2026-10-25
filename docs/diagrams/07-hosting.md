# Runtime hosting and promotion

[Atlas index](../DIAGRAMS.md). Original baseline: `cc0e3d6`; deployment review: `507a0a8`, 26 October 2026. Render details are in the [diagram guide](README.md).

## C28 — Temporary Vercel demo topology

**Status: Verified in P38-03.** The temporary demo routes public pages/REST to web and Socket.IO to API; web uses the private binding. Neon, Upstash TLS Redis and the worker daemon were exercised in P38-03. This is not future ECR production.

![Temporary Vercel demo topology. Verified in P38-03.](svg/c28-planned-render-topology.svg)

[Editable Mermaid source](sources/c28-planned-render-topology.mmd). References: [Vercel setup](../VERCEL.md).

## C29 — Demo verification and remaining gates

**Status: Demo verified; CI activation pending.** P38 implementation and manual live checks are complete. Protected main-branch CD activation remains separate; ECR publication and unchanged-image promotion are future work.

![Demo verification and remaining gates. Demo verified; CI activation pending.](svg/c29-render-activation-gates.svg)

[Editable Mermaid source](sources/c29-render-activation-gates.mmd). References: [Live demo evidence](../evidence/P38-03.md), [Current gates](../VERCEL.md#one-project-deployment-and-ci), [Open tasks](../TASKS.md).

## C30 — Selected-candidate promotion

**Status: Planned.** The future ECR promoter selects compatible manifests and preserves exact image identity with runtime settings. A new main commit must not replace a candidate already in testing.

![Selected-candidate promotion. Planned.](svg/c30-selected-candidate-promotion.svg)

[Editable Mermaid source](sources/c30-selected-candidate-promotion.mmd). References: [Build-once contract](../PROMOTION.md), [Runtime operations](../DELIVERY_OPERATIONS.md#data-promotion-and-rollback).
