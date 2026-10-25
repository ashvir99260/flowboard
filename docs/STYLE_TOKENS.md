# Color and size conventions

D140 and P15-01 define the shared UI scale. Author reusable presentation in `packages/ui`, form bindings in `packages/forms`, and app layouts using those components.

## Where tokens and theme behavior belong

| File                                                                    | Owns                                                                                          |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [tokens.ts](../packages/ui/src/modules/theme/tokens.ts)                 | Shared semantic palette inputs, spacing scale, control height and radius values               |
| [theme.ts](../packages/ui/src/modules/theme/theme.ts)                   | MUI light/dark mapping, typography, spacing function, global defaults and component overrides |
| [themeProvider.tsx](../packages/ui/src/modules/theme/themeProvider.tsx) | The public provider, Next/Emotion cache and CssBaseline                                       |

Components read semantic values through `(theme.vars ?? theme).palette` and `theme.spacing(...)`; they do not define a second palette/provider. Add a shared token only when it expresses a reusable design decision. Preserve the public `ThemeProvider` so server rendering and client hydration share the same styling setup.

For example, a reusable styled slot can use the existing theme without choosing its own light/dark colors:

```tsx
import { styled } from '@mui/material/styles';

const Root = styled('section', { name: 'FlowboardTaskSummary', slot: 'Root' })(({ theme }) => ({
  color: (theme.vars ?? theme).palette.text.primary,
  backgroundColor: (theme.vars ?? theme).palette.background.paper,
  border: `1px solid ${(theme.vars ?? theme).palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  minHeight: '4.4rem',
  padding: theme.spacing(1.6),
}));
```

This is a styling example for the [component creation workflow](UI_COMPONENT_SYSTEM.md#creating-a-shared-component), not a new exported component.

## Values and units

- Write palette colors as comma-form HSL, for example `hsl(240, 5.8824%, 10%)`. Prefer semantic theme tokens in components. The comma form is compatible with MUI's current color parser.
- Root font size is `62.5%`; MUI `typography.htmlFontSize` is 10. At a normal 16px browser default, `1rem = 10px`, `1.4rem = 14px` and `1.6rem = 16px`. Larger browser default fonts scale the UI; do not force an absolute 10px root.
- MUI spacing uses the same scale: `theme.spacing(1) = '1rem'`, `spacing(1.6) = '1.6rem'`; `sx={{ p: 1.6 }}` and `<Stack spacing={1.6}>` give 16px at the normal default. Negative/fractional values and `auto` remain supported.
- Use rem for authored fixed dimensions, padding, gaps, font sizes and offsets. Keep px for border widths and corner radii. Zero and unitless values (weight, line height, opacity, flex, z-index), percentages, viewport units, SVG coordinates and vendor-provided drag geometry retain their meanings.
- `styled` numeric dimensions mean pixels, so write `minHeight: '4.4rem'`; `sx` spacing numbers mean spacing factors. A numeric `sx.borderRadius` multiplies the theme's 6px radius; `borderRadius: 2` remains12px.
- Responsive media-query rem units use the browser's initial font, not the root declaration. Equivalent normal breakpoints are37.5rem/600px,56.25rem/900px,75rem/1200px and96rem/1536px. This also permits reflow when users choose larger text. Dialog box widths use separate document-rem values (for example `sm: 60rem`), since their CSS lengths do not use the media-query reference size.

The migration preserves existing sizes by converting old 4px spacing multipliers×0.4, old 16px-based rem sizes×1.6, and raw fixed pixel dimensions÷10. Third-party MUI-generated CSS and browser-computed styles can still report px/RGB; this policy concerns authored application styles. Do not rewrite vendor code.

Stored/API custom colors retain their existing hex contract and validated inputs. `toHslColor` converts those values when applying them to presentation, without changing records or requests. Do not turn a presentation-unit change into a schema migration.

Data Grid requires numeric pixel geometry for columns and headers. `useRemSize` observes a one-rem element and converts the authored rem values for that API; container sizing, padding and typography remain rem CSS. Initial server/client rendering uses the normal 10px equivalent, then browser measurement updates it. The observer handles later font changes and disconnects on unmount; do not hardcode pixel geometry that ignores user font preferences.

Tests cover public theme values, computed browser geometry and colors, both color schemes, responsive widths and an increased browser default font. See the official [MUI typography](https://mui.com/material-ui/customization/typography/#html-font-size), [spacing](https://mui.com/material-ui/customization/spacing/) and [CSS length](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length) references.
