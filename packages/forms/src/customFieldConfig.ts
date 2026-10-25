import type { ResolvedField } from '@flowboard/contracts';
import type { FieldPath, FieldValues } from 'react-hook-form';
import type { FormFieldConfig } from './fieldConfig.js';

export function customFieldConfig<T extends FieldValues>(
  name: FieldPath<T>,
  {
    key,
    name: label,
    type,
    required,
    options,
  }: Pick<ResolvedField, 'key' | 'name' | 'type' | 'required' | 'options'>,
): Extract<FormFieldConfig<T>, { kind: 'custom' }> {
  return { kind: 'custom', name, label, definition: { key, name: label, type, required, options } };
}
