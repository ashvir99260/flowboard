<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Flowboard web instructions

Read the [root instructions](../../AGENTS.md), [frontend guide](../../docs/FRONTEND_GUIDELINES.md), [naming conventions](../../docs/NAMING_CONVENTIONS.md) and current task. Preserve the generated Next.js block above.

- Routes/layouts stay in `app`; data-aware code lives in `src/features/<feature>`. Shared presentation belongs in `@flowboard/ui`, generic typed form wiring in `@flowboard/forms`, and shared schemas in contracts.
- Keep web feature files kebab-case and React component exports PascalCase; UI package files separately use camelCase under `modules`. Follow [exact file patterns](../../docs/NAMING_CONVENTIONS.md#exact-file-patterns) and [component creation](../../docs/UI_COMPONENT_SYSTEM.md#creating-a-shared-component). Web Node tests use `test/*.test.mjs`, and browser acceptance uses `e2e/*.spec.ts`.
- Use generated Hey API SDK/query options. Keep session-scoped query keys, validated responses and correct optimistic rollback. No handwritten domain fetches, backend imports, direct Material control imports or duplicate server-state store.
- Put TanStack Query setup in feature-owned `.ts` hooks, named `use<Operation>Query` or `use<Operation>InfiniteQuery`; views call the hooks. Keep existing composite/mutation hooks and their policies. The web view-import test enforces separation; QueryClient providers remain infrastructure.
- Use shared Zod/RHF controls with complete defaults. Preserve dirty edits, explicit clearing, server issue paths, stable option IDs and focus. Keep shareable view/filter/sort state in the URL.
- Read the [component](../../docs/UI_COMPONENT_SYSTEM.md), [form](../../docs/FORM_SYSTEM.md) and [token](../../docs/STYLE_TOKENS.md) guides before adding reusable UI. Preserve MUI/Emotion SSR, HSL/rem conventions, native semantics and keyboard alternatives.
- Action feedback uses the notification provider and shared ToastHost. Capture final results once, clear on session changes, keep background reads quiet, and use shared overlays for accessible placement.
- Browser fixtures are test-only. Verify meaningful user behavior and failure/recovery paths; real-service E2E remains the acceptance boundary for cross-layer features.

Follow [React section conventions](../../docs/CODE_STYLE.md#react-hooks-and-component-sections): separate hook groups, effects and returns, group related state/refs when dependency order allows, and never mechanically reorder hooks.
