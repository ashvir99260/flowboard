# Searchable selections and date pickers

R170–R171 replace field dropdowns with MUI Autocomplete and date controls with MUI X Community pickers. Keep action menus such as the account menu as menus; they are commands, not value selectors. Keep the existing MUI/Emotion theme, compact control sizes, RHF/Zod validation and generated API boundary.

## Selections

The UI package owns a controlled searchable selection component. Single and multiple selections preserve scalar values, stable IDs, null choices, false/zero, and unknown selected values without silently changing a draft. Typed search text does not become a new option. Multi-select uses removable chips and keyboard navigation. Nullable custom-field multi-selects distinguish an explicit clear (null) from removing the final chip (an empty array). Disabled controls retain submitted values and RHF focuses the actual input on errors.

The forms package maps existing select/multi_select descriptors to the shared component, including task assignees. Shared custom-field selectors and direct web dropdowns use the same presentation. Global search uses MUI Autocomplete over authorized server results; client filtering never replaces the server search. Preserve its page loading, errors, session clearing and workspace invalidation behavior.

## Dates

Use @mui/x-date-pickers Community 9.16.0 with Day.js 1.11.23, compatible with the installed MUI 9 and React 19. The UI package owns adapter setup and controlled DatePicker/DateTimePicker presentation. No paid component or license is required.

Date-only values remain YYYY-MM-DD calendar strings. Task due-date drafts remain UTC date/time strings without a trailing Z; the existing request mapper adds the UTC designator. Picker display must not shift values by the browser timezone. Preserve milliseconds where already present. Clearing stays distinct from malformed or incomplete text; invalid drafts must fail validation rather than silently save an old date or clear a value.

## Verification and sources

Check search/selection, duplicate labels with different IDs, clear/remove, unavailable values, required/disabled/ref behavior, date round-trips, invalid dates, UTC offsets and browser task editing. Full acceptance remains separately tracked when broad gates have not run.

Official references: [Autocomplete](https://mui.com/material-ui/react-autocomplete/), [MUI X quickstart](https://mui.com/x/react-date-pickers/quickstart/), [UTC and timezones](https://mui.com/x/react-date-pickers/timezone/).
