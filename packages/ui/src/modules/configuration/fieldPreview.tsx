'use client';

import { Alert, Stack, Typography } from '../../primitives.js';
import { CustomFieldInput } from '../forms/customFieldInput.js';

import type { FieldValue, ResolvedField } from '@flowboard/contracts';

export function FieldPreview({
  items,
  values,
  onValueChange,
  errors = [],
  label = 'Effective field preview',
}: {
  errors?: readonly string[];
  items: readonly ResolvedField[];
  label?: string;
  onValueChange: (key: string, value: FieldValue | null) => void;
  values: Readonly<Record<string, FieldValue | null>>;
}) {
  return (
    <Stack component="section" aria-label={label} spacing={1.2}>
      <Typography component="h2" variant="h3">
        {label}
      </Typography>
      <Typography variant="body2">Try example values here. They are not saved to tasks.</Typography>
      {errors.length > 0 ? (
        <Alert severity="error">{errors.join(' ')}</Alert>
      ) : items.length === 0 ? (
        <Typography>No custom fields at this scope.</Typography>
      ) : (
        items.map((field) => (
          <CustomFieldInput
            key={`${field.id}:${field.type}`}
            field={field}
            value={values[field.key] ?? null}
            onChange={(value) => onValueChange(field.key, value)}
          />
        ))
      )}
    </Stack>
  );
}
