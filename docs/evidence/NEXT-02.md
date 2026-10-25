# NEXT-02 Workspace lifecycle design

Date: 2026-10-25.
State: complete (design only).
Requirements: R156.
Commit: This record belongs to the task commit; resolve it through Git history.

## Acceptance and review

The design specifies administrator rename, reversible root-only archive, retained descendant flags/history, versioned writes, ordinary tenant/socket denial and explicit session-only restore. Existing source was reviewed in identity.ts, tenant-database.ts, workspace-events.ts, WorkspacesService, PermissionGuard/PermissionService, AuthService, RealtimeService and the browser session/picker providers.

Independent read-only review corrected four risks before implementation: retaining selected session identity avoids refresh/JWT mismatches; initial socket handshakes need archive handling as well as existing disconnects; live workspace cursors must combine visibility/keyset predicates without overwriting OR; restore must recheck the live session and current role after user → workspace locking. The design also retains fail-closed behavior after rejected switches and does not promise cancellation of prior snapshot reads.

## Verification

- Source-backed design and dependency review: pass.
- Markdown links, task/matrix consistency and formatting: pass; 481 local links, 49 anchors and all 160 requirement entries covered.
- Runtime build/lint/test: not_applicable to this documentation-only task. P29-01/P29-02 require real behavior and root gates.

R156 remains planned until both implementation tasks pass. No lifecycle endpoint, schema or browser behavior is claimed by this design commit.
