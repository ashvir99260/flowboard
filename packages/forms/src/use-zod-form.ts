'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import type { FieldValues, UseFormProps } from 'react-hook-form';
import type { z } from 'zod';

export function useZodForm<Input extends FieldValues, Output extends FieldValues = Input>(
  schema: z.ZodType<Output, Input>,
  options: Omit<UseFormProps<Input, unknown, Output>, 'resolver'>,
) {
  return useForm<Input, unknown, Output>({
    mode: 'onBlur',
    ...options,
    resolver: zodResolver(schema),
  });
}
