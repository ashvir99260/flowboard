'use client';

import { CustomFieldInput } from '@flowboard/ui';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import type { FieldValue, ResolvedField } from '@flowboard/contracts';

export function FieldPreview({
  items,
  errors = [],
  label = 'Effective field preview',
}: {
  errors?: readonly string[];
  items: readonly ResolvedField[];
  label?: string;
}) {
  const [values, setValues] = useState<Record<string, FieldValue | null>>({});

  return (
    <Stack component="section" aria-label={label} spacing={3}>
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
            onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
          />
        ))
      )}
    </Stack>
  );
}
