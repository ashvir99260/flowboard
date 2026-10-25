# Container and access administration

R160 adds an administrator screen over the existing generated hierarchy and grant APIs. It introduces no endpoint, role, dependency or persistence object. Workspace settings continue to own workspace lifecycle; this screen manages spaces, folders and lists.

## Interactions

- Create a space, folder or list using its valid parent type. Rename a selected container or change public/private visibility.
- Move siblings up/down with explicit placement commands, or move a folder/list to another valid parent. Spaces remain workspace roots. Destination status, field and assignee validation stays authoritative in the API.
- Archive after a confirmation explaining that the container, descendant containers and live tasks are archived together. Historical data remains; this screen does not add container restoration.
- Browse workspace members and edit one explicit grant at a time: allow, deny, or remove the grant. Administrators bypass grants. A deny blocks the subtree; an allow satisfies privacy only at that container, so every private ancestor still needs its own allow.

The page assembles complete, bounded cursor snapshots for the tree, member roster and selected container's grants before enabling edits. It does not treat a missing entry on a partial grant page as no grant. The roster displays a small page of the fully loaded snapshot. Names include ancestor paths to distinguish duplicate container names.

## Correctness and ownership

Web feature files under `src/features/administration` own generated queries, response validation, RHF/Zod drafts and mutations. Existing shared UI/form controls own presentation. All query keys include the session/workspace scope. No actor, role or tenant is accepted from a form.

Each form retains its loaded node/configuration versions until a successful save or explicit reload. Background changes do not overwrite a dirty draft. Navigation between containers/actions asks before discarding edits; pending saves disable navigation and repeated submission. Typed failures preserve values and focus the relevant field. Conflicts require reload. A failed reload keeps the old draft. The workspace settings host retains the screen through same-workspace navigation and hides its dialogs while inactive.

## Verification planned

Pure tests cover complete cursor snapshots, mixed revisions, foreign/duplicate rows, parent choices, minimal patches and validated write responses. Browser acceptance covers create/rename/reorder/move/archive, allow/deny/remove, multi-page membership, dirty navigation, stale failures, administrator-only entry and keyboard use. Existing backend tests continue to enforce permissions, tenant isolation and transaction safety. Verification outcomes belong in the task evidence after execution; this design is not passing evidence.
