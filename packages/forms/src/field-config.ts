import { refineFieldOptions, ResolvedFieldSchema } from '@flowboard/contracts';
import { z } from 'zod';

import type { FieldPath, FieldValues } from 'react-hook-form';

const unsafeSegments = new Set(['__proto__', 'prototype', 'constructor']);
const name = z
  .string()
  .min(1)
  .max(300)
  .refine(
    (value) =>
      value
        .split('.')
        .every((part) => /^[A-Za-z_][A-Za-z0-9_]*$|^\d+$/.test(part) && !unsafeSegments.has(part)),
    'Use a safe dot-separated field path',
  );
const common = {
  name,
  label: z.string().min(1).max(500),
  hint: z.string().max(1000).optional(),
  required: z.boolean().optional(),
  disabled: z.boolean().optional(),
};
const optionValue = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
export type SelectValue = z.infer<typeof optionValue>;

export function optionKey(value: SelectValue): string {
  return typeof value === 'string' ? value : `__flowboard:${typeof value}:${String(value)}`;
}

const options = z
  .array(z.strictObject({ label: z.string().min(1), value: optionValue }))
  .max(200)
  .superRefine((items, context) => {
    const keys = items.map((item) => optionKey(item.value));
    if (new Set(keys).size !== keys.length)
      context.addIssue({
        code: 'custom',
        message: 'Select options must have unique values',
        path: [],
      });
  });
const text = z.strictObject({
  ...common,
  kind: z.enum(['text', 'email', 'password', 'textarea', 'date']),
  autoComplete: z.string().max(100).optional(),
  emptyValue: z.literal('null').optional(),
  minRows: z.number().int().min(1).max(30).optional(),
});
const number = z.strictObject({
  ...common,
  kind: z.literal('number'),
  emptyValue: z.enum(['null', 'nan']).optional(),
});
const select = z.strictObject({ ...common, kind: z.enum(['select', 'multi_select']), options });
const checkbox = z.strictObject({ ...common, kind: z.literal('checkbox') });
const custom = z.strictObject({
  ...common,
  kind: z.literal('custom'),
  definition: z
    .strictObject({
      key: ResolvedFieldSchema.shape.key,
      name: ResolvedFieldSchema.shape.name,
      type: ResolvedFieldSchema.shape.type,
      required: ResolvedFieldSchema.shape.required,
      options: ResolvedFieldSchema.shape.options,
    })
    .superRefine(refineFieldOptions),
  clearable: z.boolean().optional(),
});
export const FormFieldsSchema = z
  .array(z.discriminatedUnion('kind', [text, number, select, checkbox, custom]))
  .max(200)
  .superRefine((fields, context) => {
    const names: string[] = [];
    for (const field of fields) {
      if (
        names.some(
          (other) =>
            other === field.name ||
            other.startsWith(`${field.name}.`) ||
            field.name.startsWith(`${other}.`),
        )
      )
        context.addIssue({
          code: 'custom',
          message: 'Field paths must be unique and cannot overlap',
          path: [],
        });

      names.push(field.name);
    }
  });

type Definition = z.infer<typeof FormFieldsSchema>[number];
export type FormFieldConfig<T extends FieldValues> = Definition extends infer D
  ? D extends Definition
    ? D['kind'] extends infer Kind
      ? Kind extends string
        ? Omit<D, 'name' | 'kind'> & { kind: Kind; name: FieldPath<T> }
        : never
      : never
    : never
  : never;

/** External JSON requires an explicit set of names owned by the receiving form. */
export function parseFormFields<T extends FieldValues>(
  input: unknown,
  allowedNames: readonly FieldPath<T>[],
): FormFieldConfig<T>[] {
  const fields = FormFieldsSchema.parse(input);
  if (fields.some((field) => !allowedNames.includes(field.name as FieldPath<T>)))
    throw new Error('Form configuration contains a field outside the allowed names');

  return fields as FormFieldConfig<T>[];
}
