'use client';

import { FormControl, FormHelperText, InputLabel, NativeSelect } from '@flowboard/ui';
import { useId } from 'react';

import { optionKey } from './field-config.js';

import type { SelectValue } from './field-config.js';

type Props = {
  disabled?: boolean;
  error?: string;
  hint?: string;
  inputRef: (element: HTMLSelectElement | null) => void;
  label: string;
  multiple: boolean;
  name: string;
  onBlur: () => void;
  onChange: (value: SelectValue | SelectValue[]) => void;
  options: readonly { label: string; value: SelectValue }[];
  required?: boolean;
  value: SelectValue | SelectValue[];
};

export function SelectInput({
  disabled,
  error,
  hint,
  inputRef,
  label,
  multiple,
  name,
  onBlur,
  onChange,
  options,
  required,
  value,
}: Props) {
  const id = useId();
  const selected = Array.isArray(value) ? value : [value];
  const unavailable = selected.filter(
    (item) => !options.some((option) => optionKey(option.value) === optionKey(item)),
  );
  const allOptions = [
    ...options,
    ...unavailable.map((item) => ({ label: `Unavailable option (${String(item)})`, value: item })),
  ];
  const message = error ?? (unavailable.length ? 'Selected option is no longer available' : hint);

  return (
    <FormControl
      disabled={disabled}
      error={Boolean(error || unavailable.length)}
      required={required}
      fullWidth
    >
      <InputLabel htmlFor={id} shrink>
        {label}
      </InputLabel>
      <NativeSelect
        inputRef={inputRef}
        value={multiple ? selected.map(optionKey) : optionKey(selected[0] ?? null)}
        onBlur={onBlur}
        onChange={(event) => {
          const values = Array.from(
            event.target.selectedOptions,
            (option) => allOptions.find((item) => optionKey(item.value) === option.value)!.value,
          );
          onChange(multiple ? values : (values[0] ?? null));
        }}
        inputProps={{
          id,
          name,
          multiple,
          'aria-required': required,
          'aria-invalid': Boolean(error || unavailable.length),
          'aria-describedby': message ? `${id}-help` : undefined,
        }}
      >
        {allOptions.map((option) => (
          <option key={optionKey(option.value)} value={optionKey(option.value)}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      {message && <FormHelperText id={`${id}-help`}>{message}</FormHelperText>}
    </FormControl>
  );
}
