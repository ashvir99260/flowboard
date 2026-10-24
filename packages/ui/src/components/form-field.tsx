'use client';

import TextField from '@mui/material/TextField';
import { useId } from 'react';

import type { TextFieldProps } from '@mui/material/TextField';

export function FormField({
  errorMessage,
  hint,
  ...props
}: Omit<TextFieldProps, 'error' | 'helperText'> & { errorMessage?: string; hint?: string }) {
  const generatedId = useId();

  return (
    <TextField
      {...props}
      id={props.id ?? generatedId}
      error={Boolean(errorMessage)}
      helperText={errorMessage ?? hint}
      fullWidth
    />
  );
}
