'use client';

import { useId } from 'react';

import { TextField } from '../primitives/TextField.js';

import type { TextFieldProps } from '@mui/material/TextField';

type FormFieldProps = Omit<TextFieldProps, 'error' | 'helperText'> & {
  errorMessage?: string;
  hint?: string;
};

export function FormField({ errorMessage, hint, ...props }: FormFieldProps) {
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
