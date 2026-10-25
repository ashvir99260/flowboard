'use client';
import { CheckboxInput } from './CheckboxInput.js';
import { DateInput } from './DateInput.js';
import { FormField } from './FormField.js';
import { NumberInput } from './NumberInput.js';
import { SelectInput } from './SelectInput.js';

import type { CustomFieldInputProps } from './customFieldTypes.js';

export function CustomFieldInput(props: CustomFieldInputProps) {
  const { disabled, error, hint, field, inputRef, onBlur, onChange, value } = props;
  if (field.type === 'number') return <NumberInput {...props} />;

  if (field.type === 'single_select' || field.type === 'multi_select')
    return <SelectInput {...props} />;

  if (field.type === 'checkbox') return <CheckboxInput {...props} />;

  if (field.type === 'date')
    return (
      <DateInput
        disabled={disabled}
        error={error}
        hint={hint}
        inputRef={inputRef}
        kind="date"
        label={field.name}
        name={field.key}
        onBlur={onBlur}
        onChange={onChange}
        required={field.required}
        value={typeof value === 'string' ? value : null}
      />
    );

  return (
    <FormField
      disabled={disabled}
      errorMessage={error}
      hint={hint}
      inputRef={inputRef}
      label={field.name}
      name={field.key}
      required={field.required}
      type="text"
      value={value ?? ''}
      onBlur={onBlur}
      onChange={(event) => onChange(event.target.value || null)}
    />
  );
}
