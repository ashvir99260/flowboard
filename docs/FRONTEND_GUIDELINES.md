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

Keep files grouped by feature and responsibility, not one global folder for every hook/component/type. Use a focused `*-data.ts` helper for pure transformations when it makes the UI easier to read; do not create empty layers or wrappers with no responsibility.

## Data and session flow

Use generated query/mutation options from `@flowboard/api-client/tanstack-query` and SDK functions from its public exports. Never hand-write an endpoint fetch that the generator provides. Transport retries and cookie handling belong in [setup-client.ts](../packages/api-client/src/setup-client.ts); the server-only proxy forwards to a fixed origin and implements no domain API.

Use [withQueryScope](../apps/web/src/lib/query-scope.ts) without breaking the generated first query-key item. Scope caches by session revision, user and workspace; clear them on logout/workspace changes. Do not place access tokens in localStorage or mirror query results into a global store. Keep shareable list/filter/sort state in the URL.

Follow [use-task-write.ts](../apps/web/src/features/tasks/use-task-write.ts) for validated write results and [use-task-mutation.ts](../apps/web/src/features/board/use-task-mutation.ts) for placement changes. Validate authoritative responses before showing success. Preserve optimistic rollback, concurrent-write guards and newer updates. Loading, empty, forbidden and recoverable error states are part of the feature.

## Forms

Use `useZodForm` with a shared/domain Zod schema, complete defaults and blur/touched validation. Compose `ControlledField`/`FormFields` from `@flowboard/forms` rather than duplicating Controller wiring. Web owns submission, server issue paths, conditional sections, reset baselines and conflict decisions. Follow [task-form-data.ts](../apps/web/src/features/tasks/task-form-data.ts) and [task-form.tsx](../apps/web/src/features/tasks/task-form.tsx).

Preserve unfinished numeric input, null/false/zero, disabled values, nested error paths and focus refs. Use stable field-array IDs. Dirty edits survive remote changes until the user resolves the conflict. JSON is a strict presentation vocabulary: parse external descriptors with an explicit allowed-name list; do not evaluate expressions or load components from JSON. Details live in the form guide.

## Presentation and accessibility

Reusable presentation belongs in UI and receives plain values, callbacks and composable children. MUI `styled()` uses semantic theme tokens; web consumes the public UI facade. Keep MUI/Emotion SSR. Use HSL authored colors and rem dimensions, with px borders/radii and the documented 62.5% root/10px MUI scale. Preserve user font preferences, media-query semantics and library drag geometry.

Use labeled native/control semantics, visible focus, keyboard and button alternatives to drag, safe Markdown and focus restoration. Check long content, 320/768/1024/1440 viewports, reduced motion and contrast. Avoid speculative memoization and boolean-heavy component APIs. [The component guide](UI_COMPONENT_SYSTEM.md) owns the available composition patterns.

## Action and realtime feedback

Use [the notification provider/store](../apps/web/src/features/notifications/notification-provider.tsx) for application feedback. Capture a reporter before a domain action and report its final validated outcome once; session actions use the session provider's lifecycle handling. Preserve inline field errors and repair controls. No-op validation, GETs, token refresh and reconnect resync do not produce success toasts.

`ToastHost` is owned by UI. Use the shared dialogs/drawers so `ToastRegion` keeps notifications within the active modal's accessibility boundary. Do not mount another ToastContainer per page. Messages are text and should not include task content or credentials.

Realtime notifications follow [api-events.md](api-events.md): negotiated content-free metadata, current session/subscription checks, event deduplication and suppression of same-account echoes. The activity feed is the durable record; transient toast state is not a notification database.

## Verification

Use public UI interaction tests and the existing browser fixtures. Pure web transforms can be tested without a browser; important product paths also need real API/PostgreSQL acceptance. Add cases for stale responses, invalid server data, forbidden access and dirty edits, not just happy-path saves. Keep fixtures explicitly separate from runtime code. Follow the root [workflow](DEVELOPMENT_WORKFLOW.md) and [quality gates](QUALITY_GATES.md) for check commands and truthful evidence.
