import { z } from 'zod';

import { CalendarDateSchema } from './dates.js';
import { ValidationIssueSchema } from './errors.js';
import { ResolvedFieldSchema } from './fields.js';
import { FieldKeySchema, textSchema, UuidSchema } from './identifiers.js';

import type { CustomFieldType } from './enums.js';
import type { ValidationIssue } from './errors.js';
import type { ResolvedField } from './fields.js';

const uuid = UuidSchema.overwrite((value) => value.toLowerCase());
const valueSchema = z.union([textSchema(2000), z.number(), z.boolean(), z.array(uuid).max(100)]);
function isPlainMap(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
    !Array.isArray(value)
  );
}
function validateKeys(value: unknown, ctx: z.RefinementCtx) {
  if (
    !isPlainMap(value) ||
    Reflect.ownKeys(value).some(
      (key) => typeof key !== 'string' || !FieldKeySchema.safeParse(key).success,
    )
  ) {
    ctx.addIssue({ code: 'custom', message: 'Expected a plain object with valid field keys' });

    return z.NEVER;
  }

  return value;
}
const rawMap = z.preprocess(validateKeys, z.record(FieldKeySchema, valueSchema));
const patchMap = z
  .preprocess(
    validateKeys,
    z.record(
      FieldKeySchema,
      z.union(
        valueSchema.options.map((schema) =>
          schema
            .meta({ description: 'A value validated against the resolved field type.' })
            .nullable(),
        ),
      ),
    ),
  )
  .refine((value) => Object.keys(value).length <= 100, 'At most 100 field keys are allowed');
const byteSize = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

export const FieldValueSchema = valueSchema.meta({
  description: 'Scalar or option-ID array. Null is a clearing command, never a stored value.',
  example: 3,
  title: 'Stored custom-field value',
});

export const FieldValuesSchema = rawMap
  .superRefine((value, ctx) => {
    if (Object.keys(value).length > 100)
      ctx.addIssue({ code: 'custom', message: 'At most 100 field keys are allowed' });

    if (byteSize(value) > 20_000)
      ctx.addIssue({ code: 'custom', message: 'Field values exceed 20000 UTF-8 JSON bytes' });
  })
  .meta({
    title: 'Custom-field values',
    description: 'Complete stored values, limited to 100 keys and 20000 UTF-8 JSON bytes.',
    example: { effort: 3 },
  });

export const FieldPatchSchema = patchMap.meta({
  title: 'Custom-field patch',
  description: 'Omitted keys retain values; explicit null removes a key before full validation.',
  example: { effort: 3, old_field: null },
});

export const FieldValuesResultSchema = z.discriminatedUnion('success', [
  z.strictObject({ success: z.literal(true), values: FieldValuesSchema }),
  z.strictObject({ success: z.literal(false), issues: z.array(ValidationIssueSchema).min(1) }),
]);

export type FieldValue = z.infer<typeof FieldValueSchema>;

export type FieldValues = z.infer<typeof FieldValuesSchema>;

export type FieldValuesResult = z.infer<typeof FieldValuesResultSchema>;

const issue = (key: string, code: string, message: string, index?: number): ValidationIssue => ({
  code,
  message,
  path: ['customFields', key, ...(index === undefined ? [] : [index])],
});
const safePath = (path: PropertyKey[]): (string | number)[] => {
  const [key, ...rest] = path;

  return typeof key === 'string' && FieldKeySchema.safeParse(key).success
    ? [key, ...rest.filter((part): part is number => typeof part === 'number')]
    : [];
};
function shapeIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.flatMap((entry) => {
    const nested =
      entry.code === 'invalid_union'
        ? entry.errors
            .flat()
            .filter((item) => item.path.length > 0)
            .map((item) => ({ ...item, path: [...entry.path, ...item.path] }))
        : [];

    return (nested.length > 0 ? nested : [entry]).map((item) => ({
      code: item.code,
      message: 'Field values do not match the declared value shape',
      path: ['customFields', ...safePath(item.path)],
    }));
  });
}

function options(field: ResolvedField): Set<string> {
  return new Set(field.options.map((option) => option.id.toLowerCase()));
}
function singleSelect(field: ResolvedField, value: FieldValue): ValidationIssue[] {
  const parsed = uuid.safeParse(value);

  return parsed.success && options(field).has(parsed.data)
    ? []
    : [issue(field.key, 'invalid_option', 'Expected an option ID from this field')];
}
function multiSelect(field: ResolvedField, value: FieldValue): ValidationIssue[] {
  if (!Array.isArray(value))
    return [issue(field.key, 'invalid_type', 'Expected an array of option IDs')];

  const allowed = options(field);
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  for (const [index, id] of value.entries()) {
    if (!allowed.has(id))
      issues.push(
        issue(field.key, 'invalid_option', 'Expected an option ID from this field', index),
      );

    if (seen.has(id))
      issues.push(issue(field.key, 'duplicate_option', 'Option IDs must be unique', index));

    seen.add(id);
  }
  if (field.required && value.length === 0)
    issues.push(issue(field.key, 'required', 'A required selection cannot be empty'));

  return issues;
}
const validators: Record<
  CustomFieldType,
  (field: ResolvedField, value: FieldValue) => ValidationIssue[]
> = {
  text: (field, value) =>
    typeof value !== 'string'
      ? [issue(field.key, 'invalid_type', 'Expected text')]
      : field.required && value.trim().length === 0
        ? [issue(field.key, 'required', 'Required text cannot be blank')]
        : [],
  number: (field, value) =>
    typeof value === 'number' ? [] : [issue(field.key, 'invalid_type', 'Expected a finite number')],
  checkbox: (field, value) =>
    typeof value === 'boolean' ? [] : [issue(field.key, 'invalid_type', 'Expected a boolean')],
  date: (field, value) =>
    CalendarDateSchema.safeParse(value).success
      ? []
      : [issue(field.key, 'invalid_date', 'Expected a real YYYY-MM-DD calendar date')],
  single_select: singleSelect,
  multi_select: multiSelect,
};
function fieldIssues(fields: readonly ResolvedField[]): ValidationIssue[] {
  const parsed = z.array(ResolvedFieldSchema).max(100).safeParse(fields);
  if (!parsed.success || new Set(fields.map((field) => field.key)).size !== fields.length)
    return [
      {
        code: 'invalid_schema',
        message: 'Expected a valid resolved field schema with unique keys',
        path: ['fields'],
      },
    ];

  return [];
}

export function validateTaskFields(input: {
  fields: readonly ResolvedField[];
  values: unknown;
}): ValidationIssue[] {
  const schemaIssues = fieldIssues(input.fields);
  if (schemaIssues.length > 0) return schemaIssues;

  if (!isPlainMap(input.values))
    return [
      { code: 'invalid_type', message: 'Expected a custom-field object', path: ['customFields'] },
    ];

  const parsed = FieldValuesSchema.safeParse(input.values);
  if (!parsed.success) return shapeIssues(parsed.error);

  const fields = new Map(input.fields.map((field) => [field.key, field]));
  const issues: ValidationIssue[] = [];
  for (const key of Object.keys(parsed.data)) {
    const field = fields.get(key);
    if (!field) issues.push(issue(key, 'unknown_field', 'Field is not available in this schema'));
    else issues.push(...validators[field.type](field, parsed.data[key]!));
  }
  for (const field of input.fields)
    if (field.required && !Object.hasOwn(parsed.data, field.key))
      issues.push(issue(field.key, 'required', 'A required field value is missing'));

  return issues;
}

export function applyTaskFieldPatch(input: {
  current: unknown;
  fields: readonly ResolvedField[];
  patch: unknown;
}): FieldValuesResult {
  const schemaIssues = fieldIssues(input.fields);
  if (schemaIssues.length > 0) return { success: false, issues: schemaIssues };

  if (!isPlainMap(input.current) || !isPlainMap(input.patch))
    return {
      success: false,
      issues: [
        {
          code: 'invalid_type',
          message: 'Expected current values and a patch object',
          path: ['customFields'],
        },
      ],
    };

  const current = rawMap.safeParse(input.current);
  const patch = patchMap.safeParse(input.patch);
  if (!current.success) return { success: false, issues: shapeIssues(current.error) };

  if (!patch.success) return { success: false, issues: shapeIssues(patch.error) };

  const next = { ...current.data };
  const fields = new Map(input.fields.map((field) => [field.key, field]));
  const issues: ValidationIssue[] = [];
  for (const [key, value] of Object.entries(patch.data)) {
    if (value === null) {
      if (!fields.has(key) && !Object.hasOwn(current.data, key))
        issues.push(issue(key, 'unknown_field', 'Cannot clear an unknown field'));

      delete next[key];
    } else next[key] = value;
  }
  issues.push(...validateTaskFields({ fields: input.fields, values: next }));
  if (issues.length > 0) return { success: false, issues };

  for (const [key, value] of Object.entries(next)) {
    const field = fields.get(key)!;
    if (field.type === 'single_select') next[key] = uuid.parse(value);
  }

  return { success: true, values: next };
}
