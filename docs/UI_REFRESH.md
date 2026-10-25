# Workspace experience refresh

R161–R163 use a ClickUp/Jira-inspired desktop information hierarchy with Flowboard's own branding and existing MUI stack. This is a product workspace, not a marketing page. The UI/UX skill's minimalism, density, focus and drag-alternative guidance applies; its generic landing-page patterns and decorative font pairings do not.

## Layout and visual rules

- One slim global header: Flowboard logo, workspace context, and right-aligned New task, Invite and Settings actions.
- A compact left sidebar below the header: workspace switcher, workspace board, collapsible spaces/folders/lists, administration links and account controls. Current selection is obvious without relying on color alone.
- A white/cool-gray canvas, restrained indigo primary color, consistent sans-serif typography, light borders and small shadows. Preserve semantic HSL tokens, rem units, 62.5% root scale, accessible focus and dark-mode compatibility.
- Main content begins with a concise breadcrumb/title and view controls; remove the large created/updated metadata block from the primary task workspace. Keep audit metadata available through existing APIs/detail views.
- Cards are compact, with a clear title, small priority/due/assignee metadata, full-card dragging and a secondary move action. Do not remove keyboard or single-pointer move alternatives.

## Views and drag behavior

The workspace home shows visible lists as columns. Each list contains tasks, and users can move tasks between lists. Selecting a sidebar list retains its existing status-based Kanban and table views. Status columns always come from that list's resolved statuses; list identity and status identity are never conflated.

Use the existing guarded move operation. Cross-list moves resolve destination status/custom-field rules and must not silently discard field data; use the existing move form when input is needed. Optimistic changes roll back on failure. Same-list placement retains status, so arbitrary cross-status ordering is performed in the existing status board. Partial pages cannot imply a complete list; show Load more and loaded counts.

The full card body is the drag surface on both boards. Keep one focusable drag group per task, with Space/arrow/Escape instructions. Native title and Move controls remain independently operable and do not start dragging. Pending writes disable dragging; no second mutation or alternative drop endpoint is introduced.

The workspace board and task editor must preserve current tenant, permission, revision and realtime rules. A task selected on the workspace board opens in its actual primary list. Do not send a guessed list/role/tenant from UI state as server authority.

## Actions

New task lives at the upper right. Within a selected list it opens that list's existing form; from the workspace board, select a destination list first. Settings groups workspace details, container creation/management, custom fields and members using existing routes. Members do not see administrator-only actions.

Invite opens a dialog with an email field and role. It calls the existing invitation API and shows the returned link for sharing. The current backend does not deliver email; success copy must say invitation created, not email sent. Preserve entered values on error, disable repeated submit, validate with shared schemas, and restore focus when the dialog closes.

## Delivery slices

- P32-01: shared visual system, branded header/sidebar and shell integration.
- P32-02: workspace lists board, cross-list drag and existing validation/rollback behavior.
- P32-03: header quick actions and the real invitation dialog.

Add regression cases for navigation, roles, keyboard drag/move, cross-list validation, dirty forms and invite failures. Capture the actual browser UI at desktop and narrow widths after assembly. Implementation is distinct from final acceptance evidence.
