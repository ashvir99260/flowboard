'use client';

import { useId, useRef, useState } from 'react';

import {
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  NativeSelect,
} from '../primitives.js';

import { FormField } from './form-field.js';

import type { FieldValue, ResolvedField } from '@flowboard/contracts';

const numberPattern = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i;
const numberValue = (value: string): FieldValue | null => {
  if (value === '') return null;

  const number = Number(value);

  return numberPattern.test(value) && Number.isFinite(number) ? number : value;
};

type CustomFieldInputProps = Readonly<{
  disabled?: boolean;
  error?: string;
  field: Pick<ResolvedField, 'key' | 'name' | 'type' | 'required' | 'options'>;
  hint?: string;
  inputRef?: (element: HTMLInputElement | HTMLSelectElement | null) => void;
  onBlur?: () => void;
  onChange: (value: FieldValue | null) => void;
  value: FieldValue | null;
}>;

function NumberInput({
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

export function CustomFieldInput({
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
  if (field.type === 'number')
    return (
      <NumberInput
        disabled={disabled}
        error={error}
        hint={hint}
        field={field}
        inputRef={inputRef}
        onBlur={onBlur}
        onChange={onChange}
        value={value}
      />
    );

  if (field.type === 'single_select' || field.type === 'multi_select') {
    const multiple = field.type === 'multi_select';
    const selected = Array.isArray(value)
      ? value
      : typeof value === 'string' && value
        ? [value]
        : [];
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

  if (field.type === 'checkbox') {
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
