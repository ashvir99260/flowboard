'use client';

import { Button, FormField, Stack, TextField } from '@flowboard/ui';

type Props = {
  clearable?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  error?: string;
  hint?: string;
  inputRef: (element: HTMLInputElement | null) => void;
  label: string;
  name: string;
  onBlur: () => void;
  onChange: (value: string | null) => void;
  onClear: () => void;
  required?: boolean;
  value: string | null;
};

export function ColorInput({
  clearable,
  clearLabel = 'Clear color',
  disabled,
  error,
  hint,
  inputRef,
  label,
  name,
  onBlur,
  onChange,
  onClear,
  required,
  value,
}: Props) {
  const pickerValue = value && /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : '#000000';

  return (
    <Stack spacing={0.4}>
      <Stack direction="row" spacing={0.8} sx={{ alignItems: 'flex-start' }}>
        <FormField
          autoComplete="off"
          disabled={disabled}
          errorMessage={error}
          hint={hint}
          inputRef={inputRef}
          label={label}
          name={name}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value || null)}
          required={required}
          value={value ?? ''}
          slotProps={{ htmlInput: { spellCheck: false } }}
        />
        <TextField
          disabled={disabled}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          type="color"
          value={pickerValue}
          slotProps={{ htmlInput: { 'aria-label': `Choose ${label}` } }}
          sx={{ width: '5rem', flexShrink: 0, '& input': { padding: '0.4rem' } }}
        />
      </Stack>
      {clearable && (
        <Button
          type="button"
          disabled={disabled || value === null}
          onClick={onClear}
          sx={{ alignSelf: 'flex-start' }}
        >
          {clearLabel}
        </Button>
      )}
    </Stack>
  );
}
