# Frontend implementation guide

The web app uses Next App Router, React, generated Hey API operations and TanStack Query. Shared UI uses MUI/Emotion with composable styled presentation. [Naming](NAMING_CONVENTIONS.md), [component ownership](UI_COMPONENT_SYSTEM.md), [forms](FORM_SYSTEM.md) and [style tokens](STYLE_TOKENS.md) define the detailed conventions.

## File ownership

| Location                           | Responsibility                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `apps/web/app/`                    | Routes, layouts, server-only configuration and the fixed-origin generic API proxy                 |
| `apps/web/src/features/<feature>/` | Data-aware views, query/mutation hooks, domain form schemas/defaults and interaction coordination |
| `apps/web/src/providers/`          | Shared app/session provider composition                                                           |
| `apps/web/src/lib/`                | Small reusable client helpers such as safe API errors and scoped query keys                       |
| `apps/web/src/server/`             | Server-only environment and proxy support                                                         |
| `packages/ui/`                     | Presentational controls, layouts, theme, composed views and Toastify rendering                    |
| `packages/forms/`                  | Generic typed RHF controls and strict JSON field rendering                                        |
| `packages/contracts/`              | Shared validation/data shapes and pure domain rules                                               |
| `packages/api-client/`             | Generated SDK/query options plus the authored session transport boundary                          |

Keep files grouped by feature and responsibility, not one global folder for every hook/component/type. Use a focused `*Data.ts` helper for pure transformations when it makes the UI easier to read; do not create empty layers or wrappers with no responsibility.

Shared UI uses PascalCase component files and camelCase hooks/helpers under `packages/ui/src/modules/<area>`, with one distinct component per file and cohesive compound slots kept together. Web adapters retain their feature folders. Follow [React section conventions](CODE_STYLE.md#react-hooks-and-component-sections): group related state/refs when dependencies permit, separate hook groups and effects with blank lines, and keep returns clear. Lint fixes whitespace; it never reorders hooks or their inputs.

Use the [shared component creation checklist](UI_COMPONENT_SYSTEM.md#creating-a-shared-component) for reusable presentation. Web owns the adapter that supplies data/actions; `packages/forms` owns generic RHF bindings. Follow the [exact file patterns](NAMING_CONVENTIONS.md#exact-file-patterns): component files are PascalCase, hook/helper files are camelCase, and query hook exports follow `use<Operation>Query` / `use<Operation>InfiniteQuery`. Keep Node `.test.mjs` and Playwright `.spec.ts` files in their current test roots.

## Data and session flow

Use generated query/mutation options from `@flowboard/api-client/tanstack-query` and SDK functions from its public exports. Never hand-write an endpoint fetch that the generator provides. Transport retries and cookie handling belong in [setup-client.ts](../packages/api-client/src/setup-client.ts); the server-only proxy forwards to a fixed origin and implements no domain API.

Use [withQueryScope](../apps/web/src/lib/queryScope.ts) without breaking the generated first query-key item. Scope caches by session revision, user and workspace; clear them on logout/workspace changes. Do not place access tokens in localStorage or mirror query results into a global store. Keep shareable list/filter/sort state in the URL.

Keep TanStack Query setup in feature-owned `.ts` hooks, separate from `.tsx` views. Name an endpoint hook `use<Operation>Query`, matching the generated operation, and use `use<Operation>InfiniteQuery` for cursor collections. For example, [useGetCurrentUserQuery](../apps/web/src/features/auth/useGetCurrentUserQuery.ts) wraps `getCurrentUserOptions`; [useListTaskActivityInfiniteQuery](../apps/web/src/features/tasks/useListTaskActivityInfiniteQuery.ts) owns activity pagination and polling. Hook filenames match their camelCase exports.

```tsx
const query = useGetCurrentUserQuery({ runtime, scope });
```

The hook owns generated options, scope tags and query policy; the view owns rendering, response-specific validation and user interaction. Preserve retry-generation tags when a caller restarts a paginated read. Existing composite hooks such as `useBoard` and `useTaskDetail` coordinate several reads and retain their descriptive names. Feature mutation hooks use `use<Operation>Mutation` and preserve their operation keys and optimistic behavior. Do not call individual hooks in a loop: dynamic parallel reads continue to use `useQueries` inside their coordinating hook.

The [view import boundary test](../apps/web/test/data-hook-boundary.test.mjs) rejects TanStack Query and generated query-option imports in feature `.tsx` files. Providers may still own `QueryClient` infrastructure. Imperative generated SDK verification, such as the task drawer's conflict check, is a separate responsibility and remains unchanged.

Follow [useTaskWriteMutation.ts](../apps/web/src/features/tasks/useTaskWriteMutation.ts) for validated write results and [useTaskPlacementMutation.ts](../apps/web/src/features/board/useTaskPlacementMutation.ts) for placement changes. Validate authoritative responses before showing success. Preserve optimistic rollback, concurrent-write guards and newer updates. Loading, empty, forbidden and recoverable error states are part of the feature.

Routine background refreshes retain only the current keyed view's validated snapshot, so focus/reconnect and task updates do not replace cards or rows with a page loader. `useBackgroundRefresh` coalesces overlapping requests and retains one trailing invalidation; hard workspace/configuration resets clear that queue and the visible snapshot. Clear terminal errors before storing any assembled ready result, because an infinite query may retain earlier pages after a later page is denied. A manual retry after denial must start without stale content. See D175 and the refresh/access browser regressions.

### Common mutation execution

All nine feature write hooks delegate to `useApiMutation` in web infrastructure. It requires a mutation key and function, forwards native TanStack generic types/callbacks/context, and enforces the existing `retry: false` and `networkMode: 'always'` policy. The helper never adds a second fetch layer, changes a command, reports success, or chooses cache invalidation.

Feature hooks such as `useTaskWriteMutation`, `useTaskPlacementMutation`, `useStatusMutation` and `useCreateWorkspaceInvitationMutation` own generated operations, trust-boundary validation, busy/conflict guards, captured notifications and cache behavior. Keep keys and variables stable: board/list observers and pending checks inspect them. Sessions continue through the coordinated runtime. The mutation boundary test rejects raw/aliased/namespace `useMutation` outside the common hook.

## Forms

Use `useZodForm` with a shared/domain Zod schema, complete defaults and blur/touched validation. Compose `ControlledField`/`FormFields` from `@flowboard/forms` rather than duplicating Controller wiring. Web owns submission, server issue paths, conditional sections, reset baselines and conflict decisions. Follow [taskFormData.ts](../apps/web/src/features/tasks/taskFormData.ts) and [TaskForm.tsx](../apps/web/src/features/tasks/TaskForm.tsx).

Preserve unfinished numeric input, null/false/zero, disabled values, nested error paths and focus refs. Use stable field-array IDs. Dirty edits survive remote changes until the user resolves the conflict. JSON is a strict presentation vocabulary: parse external descriptors with an explicit allowed-name list; do not evaluate expressions or load components from JSON. Details live in the form guide.

## Presentation and accessibility

Reusable presentation belongs in UI and receives plain values, callbacks and composable children. MUI `styled()` uses semantic theme tokens; web consumes the public UI facade. Keep MUI/Emotion SSR. Use HSL authored colors and rem dimensions, with px borders/radii and the documented 62.5% root/10px MUI scale. Preserve user font preferences, media-query semantics and library drag geometry.

Use labeled native/control semantics, visible focus, keyboard and button alternatives to drag, safe Markdown and focus restoration. Check long content, 320/768/1024/1440 viewports, reduced motion and contrast. Avoid speculative memoization and boolean-heavy component APIs. [The component guide](UI_COMPONENT_SYSTEM.md) owns the available composition patterns.

## Action and realtime feedback

Use [the notification provider/store](../apps/web/src/features/notifications/NotificationProvider.tsx) for application feedback. Capture a reporter before a domain action and report its final validated outcome once; session actions use the session provider's lifecycle handling. Preserve inline field errors and repair controls. No-op validation, GETs, token refresh and reconnect resync do not produce success toasts.

`ToastHost` is owned by UI. Use the shared dialogs/drawers so `ToastRegion` keeps notifications within the active modal's accessibility boundary. Do not mount another ToastContainer per page. Messages are text and should not include task content or credentials.

Realtime notifications follow [api-events.md](api-events.md): negotiated content-free metadata, current session/subscription checks, event deduplication and suppression of same-account echoes. The activity feed is the durable record; transient toast state is not a notification database.

## Verification

Use public UI interaction tests and the existing browser fixtures. Pure web transforms can be tested without a browser; important product paths also need real API/PostgreSQL acceptance. Add cases for stale responses, invalid server data, forbidden access and dirty edits, not just happy-path saves. Keep fixtures explicitly separate from runtime code. Follow the root [workflow](DEVELOPMENT_WORKFLOW.md) and [quality gates](QUALITY_GATES.md) for check commands and truthful evidence.
