'use client';
import { useState } from 'react';

import { FormField } from './formField.js';

import type { CustomFieldInputProps } from './customFieldTypes.js';
import type { FieldValue } from '@flowboard/contracts';

const numberPattern = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i;
const numberValue = (value: string): FieldValue | null => {
  if (value === '') return null;

  const number = Number(value);

  return numberPattern.test(value) && Number.isFinite(number) ? number : value;
};

export function NumberInput({
  disabled,
  error,
  hint,
  field,
  inputRef,
  onBlur,
  onChange,
  value,
}: CustomFieldInputProps) {
  const [draft, setDraft] = useState({ value, raw: String(value ?? '') });

  // Keep a focused textual draft; a different controlled value replaces it.
  if (!Object.is(draft.value, value)) setDraft({ value, raw: String(value ?? '') });

  return (
    <FormField
      disabled={disabled}
      errorMessage={error}
      hint={hint}
      inputRef={inputRef}
      label={field.name}
      name={field.key}
      required={field.required}
      value={draft.raw}
      onBlur={() => {
        setDraft({ value, raw: String(value ?? '') });
        onBlur?.();
      }}
      onChange={(event) => {
        const raw = event.target.value;
        const next = numberValue(raw);
        setDraft({ value: next, raw });
        onChange(next);
      }}
      slotProps={{ htmlInput: { inputMode: 'decimal' } }}
    />
  );
}
