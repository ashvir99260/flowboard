# UI Storybook

Storybook runs `@flowboard/ui` independently of Next.js, the API, PostgreSQL and Redis. Examples use local, schema-checked fixtures; story edits are not saved to Flowboard. No account or hosted service is required.

## Run and verify

Use the pinned Node/pnpm versions, then run:

```sh
pnpm install
pnpm storybook
```

Open [localhost:6006](http://localhost:6006). The toolbar switches the shared light/dark theme and 320/768/1024/1440 viewport presets. Controls edit component props; Actions records callbacks; Docs shows typed examples; Accessibility inspects the current story.

```sh
pnpm storybook:build
pnpm --filter @flowboard/ui exec playwright install chromium
pnpm storybook:test
```

The static build is written to ignored `packages/ui/storybook-static/`. Storybook's Vitest integration runs the stories and their `play` functions in Chromium, failing on configured accessibility violations. The root `pnpm test` includes story checks and the static build alongside existing UI tests. CI uses the same Chromium version as web tests. No paid visual-testing service is configured.

## Add a component example

Put typed `*.stories.tsx` files in `packages/ui/stories/`. Use `Meta<typeof Component>` with `satisfies` and `StoryObj<typeof meta>`. Import UI source within its owning package; never import app fixtures or API/session clients. The initial groups cover:

- Foundations: button variants, disabled controls and composed surfaces.
- Data display: statuses, priorities, assignees, dates and custom-field chips.
- Forms: six field types, numeric drafts, required false and unavailable options.
- Navigation and board: card callbacks, columns and independent tree expansion/selection.
- Composed views: Data Grid custom columns, keyboard task opening, font scaling, appended/reset loaded pages beyond 100 rows, configuration previews, safe Markdown and loading/empty/error states.
- Overlays: confirmation/cancellation, busy controls, focus restoration and notifications in a drawer.

Use controlled local state and `fn()` from `storybook/test` for observable callbacks. Preserve incoming Controls values and forward changes to their action callback. Add `play` functions with role/label queries, `userEvent`, `expect` and condition-based `waitFor` for important interactions. Wait for actual visible modal/toast state; do not add arbitrary sleeps or disable checks to pass a story.

Stories/configuration have a separate no-output TypeScript check and stay outside library `src`/`dist` exports. Story-only edits are excluded from app release fingerprints. Runtime source, production compiler/build settings and shared Docker/package-manager configuration still participate in release detection.

The preview uses the production `theme` with MUI's browser provider. It does not replace the application `ThemeProvider`, its Emotion/App Router integration or SSR/hydration tests. Full task forms, permissions, requests and drag orchestration remain in web; stories demonstrate presentation callbacks only.

Reference: [React/Vite setup](https://storybook.js.org/docs/get-started/frameworks/react-vite), [browser testing integration](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon).
