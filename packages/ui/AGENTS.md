# UI instructions

Follow the root/package rules, [component system](../../docs/UI_COMPONENT_SYSTEM.md), [style tokens](../../docs/STYLE_TOKENS.md) and [naming](../../docs/NAMING_CONVENTIONS.md).

Own reusable MUI/Emotion styled presentation with plain props and composable children. No API clients, router, session, permission checks or form-library bindings. Preserve polymorphic/native attributes, refs, accessible labels, DnD geometry and focus. Avoid boolean-heavy APIs and speculative abstractions.

Use semantic HSL tokens, rem sizing, the documented MUI spacing scale and px borders/radii. Keep SSR and user font preferences. Shared overlays register ToastRegion; ToastHost renders controlled React Toastify messages without owning API/session policy.

Test public rendering/interaction and responsive/light/dark accessibility behavior. Domain examples are fixtures, never fake runtime API responses. Export through the package entry point.
