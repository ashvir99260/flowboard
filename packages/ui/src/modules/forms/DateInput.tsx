'use client';

import { styled } from '@mui/material/styles';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { PickersTextField } from '@mui/x-date-pickers/PickersTextField';
import { useState } from 'react';

import { parseDateValue, serializeDateValue } from '../../utils/dateValue.js';
import { designTokens } from '../theme/tokens.js';

import type { DateInputKind } from '../../utils/dateValue.js';
import type { FieldRef } from '@mui/x-date-pickers/models';
import type { Dayjs } from 'dayjs';

export interface DateInputProps {
  disabled?: boolean;
  error?: string;
  hint?: string;
  inputRef?: (element: HTMLInputElement | null) => void;
  kind: DateInputKind;
  label: string;
  name?: string;
  onBlur?: () => void;
  onChange: (value: string | null) => void;
  required?: boolean;
  value: string | null;
}

const DateTextField = styled(PickersTextField, { name: 'FlowboardDateInput', slot: 'Field' })(
  ({ theme }) => ({
    '& .MuiPickersInputBase-root': {
      fontSize: '1.4rem',
      minHeight: designTokens.controlHeight,
      padding: '0 1.2rem',
      '@media (pointer: coarse)': { minHeight: designTokens.touchControlHeight },
    },
    '& .MuiPickersInputBase-sectionsContainer': { lineHeight: '2rem', padding: '0.7rem 0' },
    '& .MuiPickersOutlinedInput-notchedOutline': {
      borderColor: designTokens.palette.light.inputBorder,
      ...theme.applyStyles('dark', { borderColor: designTokens.palette.dark.inputBorder }),
    },
    '& .MuiPickersInputBase-root.Mui-focused .MuiPickersOutlinedInput-notchedOutline': {
      borderWidth: '1px',
    },
  }),
);

const minimumDate = parseDateValue('0000-01-01', 'date')!;
const maximumDate = parseDateValue('9999-12-31', 'date')!;

export function DateInput({
  disabled,
  error,
  hint,
  inputRef,
  kind,
  label,
  name,
  onBlur,
  onChange,
  required,
  value,
}: DateInputProps) {
  const [draft, setDraft] = useState({ value, date: parseDateValue(value, kind), kind });

  if (draft.value !== value || draft.kind !== kind) {
    setDraft({ value, date: parseDateValue(value, kind), kind });
  }

  const invalid =
    draft.value !== null && draft.value !== '' && (draft.date === null || !draft.date.isValid());
  const change = (date: Dayjs | null) => {
    if (date === null) {
      setDraft({ ...draft, date });

      return;
    }

    const next = serializeDateValue(date, kind);
    setDraft({ value: next, date, kind });
    onChange(next);
  };
  const readSections = (field: FieldRef<Dayjs | null> | null) => {
    if (field === null || draft.date !== null) return;

    // MUI emits null for a cleared section and nothing for initial partial input.
    const next = field.getSections().some((section) => section.value !== '')
      ? 'Invalid Date'
      : null;
    if (next === draft.value) return;

    setDraft({ ...draft, value: next });
    onChange(next);
  };
  const sharedProps = {
    disabled,
    label,
    name,
    onChange: change,
    value: draft.date,
    timezone: 'UTC',
    minDate: minimumDate,
    maxDate: maximumDate,
    formatDensity: 'dense' as const,
    slots: { textField: DateTextField },
    slotProps: {
      clearButton: { 'aria-label': `Clear ${label}` },
      field: { clearable: true, fieldRef: readSections },
      textField: {
        error: Boolean(error) || invalid,
        fullWidth: true,
        helperText: error ?? (invalid ? 'Enter a valid date.' : hint),
        inputRef,
        onBlur,
        required,
        size: 'small' as const,
        variant: 'outlined' as const,
        slotProps: { input: { notched: false } },
      },
    },
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      {kind === 'date' ? (
        <DatePicker {...sharedProps} format="YYYY-MM-DD" />
      ) : (
        <DateTimePicker
          {...sharedProps}
          ampm={false}
          format="YYYY-MM-DD HH:mm:ss"
          views={['year', 'month', 'day', 'hours', 'minutes', 'seconds']}
        />
      )}
    </LocalizationProvider>
  );
}
