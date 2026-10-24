'use client';
import { FieldPreview as Preview } from '@flowboard/ui';
import { useState } from 'react';

import type { FieldValue, ResolvedField } from '@flowboard/contracts';
export function FieldPreview(props: {
  errors?: readonly string[];
  items: readonly ResolvedField[];
  label?: string;
}) {
  const [values, setValues] = useState<Record<string, FieldValue | null>>({});

  return (
    <Preview
      {...props}
      values={values}
      onValueChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
    />
  );
}
