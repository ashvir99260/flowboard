'use client';

import { SelectionInput } from './SelectionInput.js';

import type { CustomFieldInputProps } from './customFieldTypes.js';

export function SelectInput({
  disabled,
  error,
  hint,
  field,
  inputRef,
  onBlur,
  onChange,
  value,
}: CustomFieldInputProps) {
  const options = field.options.map((option) => ({ label: option.label, value: option.id }));
  const shared = {
    disabled,
    error,
    hint,
    inputRef,
    label: field.name,
    name: field.key,
    onBlur,
    options,
    required: field.required,
  };

  return field.type === 'multi_select' ? (
    <SelectionInput
      {...shared}
      multiple
      onClear={() => onChange(null)}
      value={Array.isArray(value) ? value : []}
      onChange={(values) =>
        onChange(values.filter((item): item is string => typeof item === 'string'))
      }
    />
  ) : (
    <SelectionInput
      {...shared}
      value={typeof value === 'string' ? value : null}
      onChange={(next) => onChange(typeof next === 'string' ? next : null)}
    />
  );
}
