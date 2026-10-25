# NEXT-03 One-level subtask design

Date: 2026-10-25.
State: complete (design only).
Requirements: R157.
Commit: This record belongs to the task commit; resolve it through Git history.

Reviewed existing task contracts, Prisma schema, task repository, workspace transaction boundary, permission service orchestration and persisted event validation. Independent read-only review confirmed that the current workspace lock can serialize parent/child validation without new locking infrastructure.

The design chooses a same-list nullable self-relation and flat task views. It explicitly covers archived-child references, maximum depth, no-op updates, cross-list restrictions, task-only versus container archive, parent-filtered cursors, foreign/forbidden identities and old event compatibility. P30-01 and P30-02 define separate API and browser acceptance and commits.

Source checks and design acceptance mapping: pass. Local Markdown links, diagram syntax structure, task/matrix consistency and formatting are checked before commit. Runtime build/lint/test: not_applicable to this documentation-only task; no subtask implementation is claimed. R157 remains in progress until both implementation evidence records pass.
