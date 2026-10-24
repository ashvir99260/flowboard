'use client';
import { useId, useRef } from 'react';

import {
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
} from '../../primitives.js';

import type { CustomFieldInputProps } from './customFieldTypes.js';

export function CheckboxInput({
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
  const checkbox = useRef<HTMLInputElement>(null);

  return (
    <FormControl disabled={disabled} error={Boolean(error)}>
      <FormControlLabel
        label={
          <span>
            {field.name}
            {field.required && <span aria-hidden="true"> *</span>}
          </span>
        }
        control={
          <Checkbox
            checked={value === true}
            indeterminate={value === null}
            onChange={(event) => onChange(event.target.checked)}
            slotProps={{
              input: {
                id,
                name: field.key,
                onBlur,
                ref: (element) => {
                  checkbox.current = element;
                  inputRef?.(element);
                },
                'aria-required': field.required,
                'aria-invalid': Boolean(error),
                'aria-describedby': error || hint || value === null ? `${id}-error` : undefined,
              },
            }}
          />
        }
      />
      {!field.required && value !== null && (
        <Button
          disabled={disabled}
          onClick={() => {
            onChange(null);
            checkbox.current?.focus();
          }}
          aria-label={`Clear ${field.name}`}
        >
          Clear
        </Button>
      )}
      {(error || hint || value === null) && (
        <FormHelperText id={`${id}-error`}>{error ?? hint ?? 'Not set'}</FormHelperText>
      )}
    </FormControl>
  );
}
