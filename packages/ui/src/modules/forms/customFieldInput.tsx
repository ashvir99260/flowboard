'use client';
import { CheckboxInput } from './checkboxInput.js';
import { FormField } from './formField.js';
import { NumberInput } from './numberInput.js';
import { SelectInput } from './selectInput.js';

import type { CustomFieldInputProps } from './customFieldTypes.js';

export function CustomFieldInput(props: CustomFieldInputProps) {
  const { disabled, error, hint, field, inputRef, onBlur, onChange, value } = props;
  if (field.type === 'number') return <NumberInput {...props} />;

  if (field.type === 'single_select' || field.type === 'multi_select')
    return <SelectInput {...props} />;

  if (field.type === 'checkbox') return <CheckboxInput {...props} />;

  return (
    <FormField
      disabled={disabled}
      errorMessage={error}
      hint={hint}
      inputRef={inputRef}
      label={field.name}
      name={field.key}
      required={field.required}
      type={field.type === 'date' ? 'date' : 'text'}
      value={value ?? ''}
      onBlur={onBlur}
      onChange={(event) => onChange(event.target.value || null)}
      slotProps={{
        inputLabel: { shrink: field.type === 'date' ? true : undefined },
      }}
    />
  );
}
