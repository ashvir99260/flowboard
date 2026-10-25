# UI instructions

Follow the root/package rules, [component system](../../docs/UI_COMPONENT_SYSTEM.md), [style tokens](../../docs/STYLE_TOKENS.md) and [naming](../../docs/NAMING_CONVENTIONS.md).

Own reusable MUI/Emotion styled presentation with plain props and composable children. No API clients, router, session, permission checks or form-library bindings. Preserve polymorphic/native attributes, refs, accessible labels, DnD geometry and focus. Avoid boolean-heavy APIs and speculative abstractions.

Use camelCase filenames and `src/modules/<area>` for presentation. Keep one public component implementation per file; compound components may retain their cohesive private styled slots. Theme/primitive/layout/form/board/task/configuration/notification responsibilities have separate modules. Pure shared utilities and hooks live in `src/utils` and `src/hooks`. Keep `src/index.ts` as the stable public barrel and `src/primitives.ts` as a reexport facade; internal modules import leaf files rather than the public root. Test/story/config suffixes retain their tool conventions.

Use semantic HSL tokens, rem sizing, the documented MUI spacing scale and px borders/radii. Keep SSR and user font preferences. Shared overlays register ToastRegion; ToastHost renders controlled React Toastify messages without owning API/session policy.

Test public rendering/interaction and responsive/light/dark accessibility behavior. Domain examples are fixtures, never fake runtime API responses. Export through the package entry point.

TaskTable owns MUI Data Grid Community presentation and pagination of already-loaded rows. Keep web's URL sort/filter and cursor loading authoritative. Preserve title-button roving focus, drawer focus attributes, inherited/local labels and rem-derived geometry; see the component system guide before changing grid behavior.

Use the [Storybook guide](../../docs/STORYBOOK.md) for component examples. Keep stories outside `src`, use typed CSF and local props, and add meaningful `play` interactions for important behaviors. Reuse the shared theme; do not import web fixtures, API clients or forms adapters. Run the story build/browser checks with the normal UI gates.

Follow [React section conventions](../../docs/CODE_STYLE.md#react-hooks-and-component-sections). Group related state/refs, separate hook blocks and each effect, and preserve dependency-sensitive order. Lint fixes spacing only; never mechanically sort hooks. Rules of Hooks and dependency checks also apply to `.ts` hook files.
