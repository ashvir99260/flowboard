# Flowboard workspace design system

Product: desktop-first collaborative project management, implemented with Next.js, MUI/Emotion and shared headless-style composition.

Direction: dense and quiet. Use one strong workspace title, compact controls, thin neutral dividers, white task cards and restrained indigo accents. Use the existing sans-serif font stack; no marketing hero, gradients, decorative serif typography or copied product marks.

Header: approximately 6rem tall, original Flowboard mark/name at left, workspace context and task/invite/settings actions at right. Sidebar: approximately 25rem wide at desktop, collapsible overlay at narrow widths. Main content: flexible, with boards scrolling internally.

Tokens remain in `packages/ui/src/modules/theme/tokens.ts`; map them through the existing theme. HSL literals belong only in tokens. Use rem dimensions and spacing, px only for borders/radii. Preserve user font scaling, visible keyboard focus, reduced motion and contrasting light/dark states.

Interaction: distinguish task title/open from drag handle; keep keyboard and button move alternatives. Do not show fake counts, placeholder actions or success before the API commits. Surface loaded counts and incomplete pagination explicitly.

Source selection: UI/UX Pro Max's Minimalism & Swiss Style and desktop keyboard/drag accessibility guidance fit this product. Generic funnel/product-demo layouts, teal/orange branding and decorative font recommendations from broad searches were rejected as unsuitable. This document is the project-specific synthesis, not unreviewed generated output.

Detailed behavior and delivery: `docs/UI_REFRESH.md`.
