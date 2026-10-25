'use client';

import { Checkbox, FormControl, FormControlLabel, FormHelperText } from '@flowboard/ui';
import { useId } from 'react';

export function CheckboxInput({
  checked,
  disabled,
  error,
  hint,
  inputRef,
  label,
  name,
  onBlur,
  onChange,
  required,
}: {
  checked: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  inputRef: (element: HTMLInputElement | null) => void;
  label: string;
  name: string;
  onBlur: () => void;
  onChange: (value: boolean) => void;
  required?: boolean;
}) {
  const id = useId();

  const message = error ?? hint;

  return (
    <FormControl disabled={disabled} error={Boolean(error)} required={required}>
      <FormControlLabel
        label={label}
        control={
          <Checkbox
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            slotProps={{
              input: {
                id,
                name,
                ref: inputRef,
                onBlur,
                'aria-required': Boolean(required),
                'aria-invalid': Boolean(error),
                'aria-describedby': message ? `${id}-help` : undefined,
              },
            }}
          />
        }
      />
      {message && <FormHelperText id={`${id}-help`}>{message}</FormHelperText>}
    </FormControl>
  );
}
