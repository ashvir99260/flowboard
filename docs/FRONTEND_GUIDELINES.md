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

Hey API generates SDK operations, query/infinite-query factories, query keys, mutation functions and mutation keys from the committed OpenAPI document. The web generator consumes that output inventory and produces [apiHooks.gen.ts](../apps/web/src/generated/apiHooks.gen.ts). Runtime code imports the API client's public exports; the generator's source reads are build-only inputs. Do not hand-edit either generated layer or recreate its endpoint plumbing.

Transport retries and cookies remain in [setup-client.ts](../packages/api-client/src/setup-client.ts). The fixed-origin server proxy implements no domain API. Generated UI hooks require the current runtime and scope, bind the session client, and preserve the generated first key object with revision/user/workspace tags. Clear caches on logout/workspace changes; never store access tokens in localStorage.

### Generated API binding contract

Use operation-based names consistently:

| Purpose                 | Example                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| Query key / options     | `getNodeQueryKey` / `getNodeOptions`                             |
| Query hook              | `useGetNodeQuery`                                                |
| Infinite options / hook | `listTasksInfiniteOptions` / `useListTasksInfiniteQuery`         |
| Mutation key / options  | `createTaskMutationKey` / `createTaskMutation`                   |
| Mutation hook           | `useCreateTaskMutation`                                          |
| Types                   | `GetNodeQueryInput`, `GetNodeQueryOptions`, `GetNodeQueryResult` |

```tsx
import { useGetNodeQuery } from '../../generated/apiHooks.gen';

const query = useGetNodeQuery({ runtime, scope, path: { nodeId } });
```

Generated input types expose request body/path/query fields and the runtime/scope context. Options cannot replace owned keys/functions. Generated mutation hooks run through [useApiMutation](../apps/web/src/lib/useApiMutation.ts), preserving `retry: false`, `networkMode: 'always'`, and safe observer handling. The [binding runtime](../apps/web/src/lib/apiBindings.ts) keeps the client bound even if a JavaScript caller supplies an override.

Factories remain available to feature-owned `.ts` hooks that coordinate multiple reads. Apply [withQueryScope](../apps/web/src/lib/queryScope.ts) there; generated endpoint hooks do it automatically. Infinite hooks use Hey API's cursor merge/function, while the feature supplies validated next-page handling and page limits. Preserve retry-generation tags, cancellation and bounded lazy loading. Dynamic reads use `useQueries`, not hooks in loops.

### Feature policy and mutations

Keep domain behavior in feature hooks such as [useTaskWriteMutation](../apps/web/src/features/tasks/useTaskWriteMutation.ts), [useTaskPlacementMutation](../apps/web/src/features/board/useTaskPlacementMutation.ts) and composite readers such as `useBoard`/`useTaskDetail`. They consume generated options/functions instead of defining endpoint requests. Validate authoritative responses before success; preserve mixed-version rejection, dirty drafts, stale-page recovery and optimistic rollback.

Logical mutation keys (`configuration-write`, `task-write`, `task-placement`) group several endpoint operations. Keep their scope tuple and command shapes because busy guards, refresh subscribers and pending projections inspect them. Generated operation keys belong to endpoint primitives; replacing a logical key with one operation ID changes behavior.

Use native `mutate` or awaited `mutateAsync`. Keep synchronous busy guards in owned `onMutate`, account for the current pending mutation, capture notification generation before execution can be delayed, and clear immediate placement in hook-level `onSettled`. Required cache/notification work precedes caller observers. Pass the actual mutation context into generated mutation functions. UI components consume hooks rather than configuring query or mutation plumbing. The existing imperative task-save verification still uses the generated SDK for its authoritative conflict check; it does not define transport or cache machinery.

Sign-in, sign-out, sign-up, refresh and workspace-switch operations stay in the coordinated session runtime. Health probes also stay outside generated UI hooks. The generator explicitly excludes those operations rather than bypassing session transitions.

### Generation and enforcement

Run `pnpm gen:api` to regenerate OpenAPI, Hey API output and web bindings in dependency order. Run `pnpm client:check` to verify both client layers. Normal web builds and type checks also reject stale bindings without rewriting files. Naming and coverage come from [the generator](../apps/web/scripts/api-bindings.mjs); a new supported operation is included automatically. Generation validates companion keys/types and fails on incomplete inputs or naming collisions.

The [generation tests](../apps/web/test/api-bindings-generation.test.mjs) cover new operations, drift, protected client/key policy and typed output. [Feature hook checks](../apps/web/test/api-hook-style.test.mjs) retain explicit options/results and require generated endpoint bindings. The [view boundary](../apps/web/test/data-hook-boundary.test.mjs) keeps TanStack setup out of components. [Request tests](../apps/web/test/api-request-functions.test.mjs) and [native mutation tests](../apps/web/test/native-api-mutations.test.mjs) cover cancellation, scoped identity, validated errors and concurrency. Generated files are exempt from authored-file naming rules; they remain compiled and checked for drift. Review still owns business validation and invalidation choices.

## Forms

Use `useZodForm` with a shared/domain Zod schema, complete defaults and blur/touched validation. Compose `ControlledField`/`FormFields` from `@flowboard/forms` rather than duplicating Controller wiring. Web owns submission, server issue paths, conditional sections, reset baselines and conflict decisions. Follow [taskFormData.ts](../apps/web/src/features/tasks/taskFormData.ts) and [TaskForm.tsx](../apps/web/src/features/tasks/TaskForm.tsx).

Preserve unfinished numeric input, null/false/zero, disabled values, nested error paths and focus refs. Use stable field-array IDs. Dirty edits survive remote changes until the user resolves the conflict. JSON is a strict presentation vocabulary: parse external descriptors with an explicit allowed-name list; do not evaluate expressions or load components from JSON. Details live in the form guide.

## Presentation and accessibility

Reusable presentation belongs in UI and receives plain values, callbacks and composable children. MUI `styled()` uses semantic theme tokens; web consumes the public UI facade. Keep MUI/Emotion SSR. Use HSL authored colors and rem dimensions, with px borders/radii and the documented 62.5% root/10px MUI scale. Preserve user font preferences, media-query semantics and library drag geometry.

Use labeled native/control semantics, visible focus, keyboard and button alternatives to drag, safe Markdown and focus restoration. Check long content, 320/768/1024/1440 viewports, reduced motion and contrast. Avoid speculative memoization and boolean-heavy component APIs. [The component guide](UI_COMPONENT_SYSTEM.md) owns the available composition patterns.

Containers, Statuses and Custom Fields follow the [settings collection contract](UI_COMPONENT_SYSTEM.md#settings-collections-and-details). Reuse the shared presentation and keep selected items, form drafts, permissions and mutation handling in the feature adapter.

## Action and realtime feedback

Use [the notification provider/store](../apps/web/src/features/notifications/NotificationProvider.tsx) for application feedback. Capture a reporter before a domain action and report its final validated outcome once; session actions use the session provider's lifecycle handling. Preserve inline field errors and repair controls. No-op validation, GETs, token refresh and reconnect resync do not produce success toasts.

`ToastHost` is owned by UI. Use the shared dialogs/drawers so `ToastRegion` keeps notifications within the active modal's accessibility boundary. Do not mount another ToastContainer per page. Messages are text and should not include task content or credentials.

Realtime notifications follow [api-events.md](api-events.md): negotiated content-free metadata, current session/subscription checks, event deduplication and suppression of same-account echoes. The activity feed is the durable record; transient toast state is not a notification database.

## Verification

Use public UI interaction tests and the existing browser fixtures. Pure web transforms can be tested without a browser; important product paths also need real API/PostgreSQL acceptance. Add cases for stale responses, invalid server data, forbidden access and dirty edits, not just happy-path saves. Keep fixtures explicitly separate from runtime code. Follow the root [workflow](DEVELOPMENT_WORKFLOW.md) and [quality gates](QUALITY_GATES.md) for check commands and truthful evidence.
