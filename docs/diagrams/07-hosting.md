# Runtime hosting and promotion

[Atlas index](../DIAGRAMS.md). Source snapshot: `cc0e3d6`; render/update details are in the [diagram guide](README.md).

## C28 — Planned Render topology

**Status: Planned; not deployed.** This is a target plan, not a deployment record. The current adapter still targets Vercel/Northflank. Worker/persistent-storage capacity and live Render acceptance remain open.

![Planned Render topology. Planned; not deployed.](svg/c28-planned-render-topology.svg)

[Editable Mermaid source](sources/c28-planned-render-topology.mmd). References: [Render plan](../RENDER.md).

## C29 — Render activation gates

**Status: Planned.** The plan has explicit infrastructure, implementation and live-verification gates. A successful API trigger or a source diagram cannot substitute for running-digest and product acceptance evidence.

![Render activation gates. Planned.](svg/c29-render-activation-gates.svg)

[Editable Mermaid source](sources/c29-render-activation-gates.mmd). References: [Render rollout](../RENDER.md#implementation-and-rollout-sequence), [Open tasks](../TASKS.md#phase-22--delivery-operations-and-render-plan).

## C30 — Selected-candidate promotion

**Status: Planned.** The future promoter must select explicit manifests, preserve image identity and record environment/configuration evidence. A new main commit must not silently replace a candidate already in testing.

![Selected-candidate promotion. Planned.](svg/c30-selected-candidate-promotion.svg)

[Editable Mermaid source](sources/c30-selected-candidate-promotion.mmd). References: [Build-once contract](../PROMOTION.md), [Runtime operations](../DELIVERY_OPERATIONS.md#data-promotion-and-rollback).
