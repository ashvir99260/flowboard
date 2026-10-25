# Flowboard documentation

New to the repository? Read these in order:

| Document                                  | Answers                                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [Application guide](APPLICATION_GUIDE.md) | What can the app do? Which app/package/library does what? Where do I start?                          |
| [High-level design](HLD.md)               | How do clients, API, worker, database and Redis fit together? What are the boundaries and tradeoffs? |
| [Low-level design](LLD.md)                | How do auth, permissions, repositories, configuration, mutations, cursors and events work?           |
| [Delivery summary](DELIVERY_SUMMARY.md)   | How did each prompt area become code? Which tasks/evidence prove it, and what is still open?         |

Explore the [diagram atlas](DIAGRAMS.md) for 30 rendered architecture, security, domain, frontend, queue and delivery views. Each links to editable Mermaid source and its owning reference.

These are as-built summaries with a named source snapshot. The following documents retain the detailed contracts and operating rules:

| Need                                         | Canonical reference                                                                                                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run locally, users, ports and tests          | [Project README](../README.md).                                                                                                                           |
| Original requirements and latest status      | [Original brief](REQUIREMENTS.md), [matrix](REQUIREMENTS_MATRIX.md).                                                                                      |
| AI contributions and priorities              | [AI usage and corrections](AI_USAGE.md), [delivery roadmap](ROADMAP.md).                                                                                  |
| Ordered work and verification                | [Plan](PLAN.md), [tasks](TASKS.md), [decisions](DECISIONS.md), [evidence](evidence/README.md).                                                            |
| Tables, relations, attributes and validation | [Database design](DATABASE_DESIGN.md), [field reference](FIELD_REFERENCE.md).                                                                             |
| API contracts and examples                   | [API catalog](API_CATALOG.md), [backend contracts](BACKEND_CONTRACTS.md), [event contracts](api-events.md), [curl cookbook](../scripts/curl-cookbook.md). |
| Change impact and implementation conventions | [Architecture map](../ARCHITECTURE.md), [agent guide map](agents/README.md), [workflow](DEVELOPMENT_WORKFLOW.md).                                         |
| Components/forms/styles                      | [UI system](UI_COMPONENT_SYSTEM.md), [forms](FORM_SYSTEM.md), [tokens](STYLE_TOKENS.md), [Storybook](STORYBOOK.md).                                       |
| Delivery and hosting                         | [Independent delivery](DELIVERY.md), [CI/CD](CI_CD.md), [future promotion](PROMOTION.md).                                                                 |
| Delivery operating model                     | [Trunk-based development, runtime environments and release examples](DELIVERY_OPERATIONS.md).                                                             |
| Redis and background work                    | [Redis roles, BullMQ, outbox, activity and recovery](REDIS_AND_JOBS.md).                                                                                  |
| Planned hosting target                       | [Render topology, settings, limits and remaining implementation](RENDER.md).                                                                              |
| Background research                          | [Product architecture references](REFERENCE_ARCHITECTURES.md), [earlier system design](SYSTEM_DESIGN.md), [UI references](UI_DESIGN.md).                  |

Use source/schema plus task evidence to resolve stale design language. Historical research is not a claim about third-party internals, and planned hosting/promotion is not live deployment evidence. When behavior changes, update its owning reference and evidence before refreshing the summaries.
