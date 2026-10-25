# Runtime hosting and promotion

[Atlas index](../DIAGRAMS.md). Source snapshot: `cc0e3d6`; render/update details are in the [diagram guide](README.md).

## C28 — Selected Vercel Services topology

**Status: Configured; not deployed.** The repository config routes public web and Socket.IO traffic to Vercel Services and runs the worker as a Daemon. The legacy deployment adapter is not reconciled; preview worker processing and external Redis capacity remain open.

![Selected Vercel Services topology. Configured; not deployed.](svg/c28-planned-render-topology.svg)

[Editable Mermaid source](sources/c28-planned-render-topology.mmd). References: [Vercel setup](../VERCEL.md).

## C29 — Vercel activation gates

**Status: Planned.** The plan has explicit infrastructure, implementation and live-verification gates. A successful API trigger or a source diagram cannot substitute for running-digest and product acceptance evidence.

![Vercel activation gates. Planned.](svg/c29-render-activation-gates.svg)

[Editable Mermaid source](sources/c29-render-activation-gates.mmd). References: [Vercel deployment gaps](../VERCEL.md#build-deployment-and-current-gaps), [Open tasks](../TASKS.md).

## C30 — Selected-candidate promotion

**Status: Planned.** The future promoter must select explicit manifests, preserve image identity and record environment/configuration evidence. A new main commit must not silently replace a candidate already in testing.

![Selected-candidate promotion. Planned.](svg/c30-selected-candidate-promotion.svg)

[Editable Mermaid source](sources/c30-selected-candidate-promotion.mmd). References: [Build-once contract](../PROMOTION.md), [Runtime operations](../DELIVERY_OPERATIONS.md#data-promotion-and-rollback).
