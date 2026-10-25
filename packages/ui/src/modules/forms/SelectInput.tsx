'use client';
import { useId } from 'react';

import { default as FormControl } from '@mui/material/FormControl';
import { default as FormHelperText } from '@mui/material/FormHelperText';
import { default as InputLabel } from '@mui/material/InputLabel';
import { NativeSelect } from '../primitives/NativeSelect.js';

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
  const id = useId();

  const multiple = field.type === 'multi_select';
  const selected = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : [];
  const unavailable = selected.filter(
    (item) => !field.options.some((option) => option.id === item),
  );
  const message = error ?? (unavailable.length ? 'Selected option is no longer available' : hint);

  return (
    <FormControl
      disabled={disabled}
      error={Boolean(error || unavailable.length)}
      required={field.required}
      fullWidth
    >
      <InputLabel htmlFor={id} shrink>
        {field.name}
      </InputLabel>
      <NativeSelect
        inputRef={inputRef}
        value={multiple ? selected : (selected[0] ?? '')}
        onBlur={onBlur}
        onChange={(event) =>
          onChange(
            multiple
              ? Array.from(event.target.selectedOptions, (option) => option.value)
              : event.target.value || null,
          )
        }
        inputProps={{
          id,
          name: field.key,
          multiple,
          'aria-required': field.required,
          'aria-invalid': Boolean(error || unavailable.length),
          'aria-describedby': message ? `${id}-error` : undefined,
        }}
      >
        {!multiple && <option value="">Not set</option>}
        {unavailable.map((item) => (
          <option key={item} value={item}>
            Unavailable option ({item})
          </option>
        ))}
        {field.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      {message && <FormHelperText id={`${id}-error`}>{message}</FormHelperText>}
    </FormControl>
  );
}
