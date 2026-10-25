# Flowboard diagram atlas

Thirty focused diagrams explain how Flowboard is structured, how data moves, and which deployment work remains planned. Original baseline: `cc0e3d6` (P22-01). Deployment/worker diagrams C01/C02/C24/C27–C30 were reviewed against `507a0a8` on 26 October 2026. Every diagram has a rendered SVG, an editable Mermaid source, a short explanation and links to the owning code or guide.

## Choose a chapter

| Chapter                                                          | Diagrams | Questions answered                                                                                        |
| ---------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| [System and data](diagrams/01-system.md)                         | C01–C04  | Who talks to what? Which packages own which work? How are records related and clients generated?          |
| [Authentication and access](diagrams/02-security.md)             | C05–C08  | How do login, refresh, tenant scope and ancestor permissions work?                                        |
| [Domain rules and writes](diagrams/03-domain.md)                 | C09–C13  | How do statuses/fields inherit? How are configuration, moves and ordering validated atomically?           |
| [Frontend flows](diagrams/04-frontend.md)                        | C14–C17  | Where does UI logic live? How do board loading, drag state and form recovery work?                        |
| [Redis and background work](diagrams/05-async.md)                | C18–C22  | How are jobs delivered, retried, recovered and filtered before reaching clients?                          |
| [CI and independent releases](diagrams/06-delivery.md)           | C23–C27  | How do branches, eight CI lanes, per-app versions, publication and runtime settings connect?              |
| [Temporary hosting and future promotion](diagrams/07-hosting.md) | C28–C30  | How is the Vercel target composed, what deployment gates remain, and how should unchanged images advance? |

## Read the status labels

**Implemented** means the diagram describes the existing source, not that this documentation task reran every product test. **Operating model** describes the intended working process. **Verified in P38-03** refers to the recorded temporary Vercel demo, not a new live check by this documentation task. **Planned** covers ECR and four-environment promotion; protected main-branch CD remains separate. C27 combines implemented runtime seams with explicitly planned ECR/promotion.

Solid arrows show the relationship named in the diagram; sequence diagrams indicate time, while dependency/relationship maps do not. Dashed arrows show a constraint, annotation or planned step, as labeled. An arrow is not an implied foreign key or direct network connection unless the diagram says so. In particular, browsers never connect directly to PostgreSQL/Redis, and workers reach clients through authorized API gateways.

These drawings simplify one question at a time. [Architecture](../ARCHITECTURE.md), [database design](DATABASE_DESIGN.md), [API contracts](API_CATALOG.md) and source code remain authoritative. Use the full schema for omitted fields/constraints, including audit timestamps. Diagram rendering proves syntax/layout, not application correctness.

See [editing and rendering](diagrams/README.md) and the [machine-readable inventory](diagrams/catalog.json).
