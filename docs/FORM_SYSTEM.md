# Shared form system

Status: implemented and verified in [P14-01](evidence/P14-01.md) and [P14-02](evidence/P14-02.md); D139 records the boundary.

Web → `@flowboard/forms` → `@flowboard/ui` → MUI/Emotion. Contracts supply domain types and Zod schemas. Forms supplies accessible RHF bindings and a strict JSON field renderer. Web retains schema selection, complete defaults, asynchronous submission, server-error mapping, reset and conflict decisions. The UI theme/styles stay shared.

JSON describes field names, labels, widget kinds, hints, options and native input metadata. It cannot execute callbacks, import components, add validation rules or initiate requests. A provided Zod schema validates values. External descriptors additionally require an explicit allowed-name list, since a syntactically safe name need not be authorized for a particular form. Unknown/duplicate/prototype-related names, ambiguous options and unsupported keys fail before rendering.

Use small typed controls for custom layouts, and the same controls through `FormFields` for data-driven sections. Keep conditional sections and repeatable option rows in React; useFieldArray-generated row IDs remain React keys. Preserve empty versus explicit null and route each error to the actual input ref. Do not reset on descriptor rerenders or put visual disabled state into RHF registration.

## Verification focus

Public component tests cover blur validation, blocked invalid submission, first-error focus, nested server errors, callback composition, reset/dirty preservation, disabled values, schema transformations, false/zero/null, multi-select and unsafe JSON. Existing browser journeys cover auth, task edits, destination validation and configuration arrays. API, DB and generated contracts are unchanged.

## Public API

```tsx
const schema = z.object({ email: z.email(), name: z.string().min(1) });
const form = useZodForm(schema, { defaultValues: { email: '', name: '' } });
const fields = [
  { kind: 'email', name: 'email', label: 'Email', autoComplete: 'email' },
  { kind: 'text', name: 'name', label: 'Your name' },
] satisfies FormFieldConfig<z.input<typeof schema>>[];

<form noValidate onSubmit={form.handleSubmit(save)}>
  <FormFields control={form.control} fields={fields} />
  <Button type="submit">Save</Button>
</form>;
```

Import `useZodForm`, `FormFields`, `ControlledField`, `parseFormFields` and the configuration type from `@flowboard/forms`; UI layout and buttons remain `@flowboard/ui`. For a custom layout, render `ControlledField` with one `config`. Its optional `onValueChange(name, value)` runs after the RHF value update. Server failures use the owning form's `setError`; actual input refs support `setFocus`. Rendered `disabled` retains form data, so it is not an authorization control.

JSON payloads use the same descriptors, e.g. `[{"kind":"email","name":"email","label":"Email"}]`. Parse external payloads with `parseFormFields<Values>(payload, ['email'])` before rendering. The allowed-name list comes from the trusted form, not the payload. Select values can be strings, finite numbers, booleans or null; multi-select returns an array. Strings stay compatible with native option IDs; ambiguous encoded values are rejected. Text defaults to an empty string, or use `emptyValue: 'null'` for nullable fields. Numeric controls retain unfinished drafts for Zod to reject; blank becomes null, or `emptyValue: 'nan'` for required numeric schemas. A `custom` descriptor wraps the existing domain input and validates its definition with shared option rules. `clearable` exposes explicit null clearing only for optional custom fields.

The schema input type controls defaults and names, while its output type controls submit callbacks. `useZodForm` defaults to blur validation and accepts ordinary RHF options. Supply complete defaults for every field. It does not reset on configuration changes or fetch data. This follows the official [useController contract](https://react-hook-form.com/docs/usecontroller) and [Zod resolver input/output typing](https://github.com/react-hook-form/resolvers#typescript).

## Product integration

Task, status, field-definition and move forms use the same controlled inputs. Domain field definitions become descriptors through `customFieldConfig`, which copies only presentation properties. Inherited/local indicators, conditional anchors, Markdown previews, option arrays and asynchronous saves stay in the owning web feature. The playground includes a real JSON string parsed with an explicit allowlist and validated by a Zod schema. Generic selects allow up to 10,000 choices to preserve the existing paginated member/anchor limits (5,000 records plus retained choices); domain custom-field options retain their stricter contract limit.

## Task due instants

Task due dates use the generic datetime-local widget with millisecond step precision. Web owns the UTC adapter, label and validation: existing instants become suffix-free UTC control values, and submitted values become canonical UTC instants. A native minute-only control value gains zero seconds; existing seconds/milliseconds are preserved. Blank input clears to null. Custom fields of type date continue using calendar-day controls.

The UTC adapter is owned by the web task form; custom date fields retain calendar-day validation. See [D156](DECISIONS.md#d156--task-due-instants-and-utc-editing) and [P28-06 evidence](evidence/P28-06.md).
