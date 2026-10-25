# Workspace clarity and global search

This follow-up keeps MUI/Emotion, the shared component library, existing typography and semantic HSL/rem tokens. The goal is a compact, consistent project workspace: clear navigation, restrained surfaces, visible status-column boundaries and direct actions. Apply these shared improvements across workspace home, board, table, settings, task detail and dialogs; do not replace the existing domain flows.

## Interaction decisions

- Clicking a task card's non-interactive body opens the existing task drawer. Title keyboard activation still works. Dragging must not open the drawer; Move and other nested controls must not trigger card opening.
- Keep tasks aligned at the left of their columns. Separate status/list columns with subtle theme-aware borders and reduce wasted card space. Unassigned tasks use an avatar marked UN with an accessible Unassigned label.
- Move identity to the upper-right account menu: avatar initials, name and workspace role, with Sign out inside. Keep administration navigation in the sidebar. Replace the header Settings action with a theme toggle. Preserve New task and Invite.
- Put workspace-wide search in the header. Use an explicit search submit and keyboard-accessible result dialog with loading, empty, error and pagination states. Search the active workspace's tasks and lists; never another workspace. Results include authorized ancestor context, and open the real task/list route.
- Replace dismiss/close text with recognizable X icon buttons where the action closes a toast, drawer or popup. Keep accessible names, disabled states and focus restoration. Confirmation actions such as Cancel/Discard remain explicit text.
- Status colors use a real color picker with a text value and an explicit inherit/clear choice where inheritance is supported. Keep current validation and null semantics.

## Search boundary

Add GET /v1/search using the existing token-resolved workspace, DB-backed membership and central permission policy. Reuse bounded PostgreSQL search semantics. Search live task titles/descriptions and list names, filter inaccessible ancestors before pagination, and return only typed display/navigation data. Cursor pagination binds query, workspace, caller and revisions; stale or mismatched cursors fail safely. No schema migration or separate indexing service is needed.

The web consumes the generated operation through a feature-owned query hook. Cache keys include the existing session scope and query. Old results clear on workspace/session changes. Workspace invalidations and current-scope mutations restart search from its first page instead of preserving revoked titles or stale cursors. The header never scans unfiltered tasks on the client.

## Delivery

P34-02 completes card opening. P35-01 implements shared visual/close/avatar refinements. P35-02 adds the typed form color control. P35-03 adds and verifies the search API/contracts. P35-04 composes the header, account/theme controls and generated search in the app. Each slice records its actual verification and remains awaiting final acceptance when full gates have not run.
