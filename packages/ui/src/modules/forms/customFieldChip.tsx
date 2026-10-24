'use client';

import { Chip } from '../../primitives.js';
import { formatCalendarDate } from '../../utils/formatDate.js';

import type { CustomFieldType, FieldValue, ResolvedField } from '@flowboard/contracts';

export function CustomFieldChip({
  field,
  value,
}: Readonly<{
  field: Pick<ResolvedField, 'name' | 'options' | 'type'>;
  value?: FieldValue | null;
}>) {
  const option = (id: string) =>
    field.options.find((item) => item.id === id)?.label ?? 'Unknown option';
  const formatters: Record<CustomFieldType, (input: FieldValue) => string> = {
    text: (input) => (typeof input === 'string' ? input : 'Invalid value'),
    number: (input) =>
      typeof input === 'number' && Number.isFinite(input) ? String(input) : 'Invalid value',
    checkbox: (input) => (typeof input === 'boolean' ? (input ? 'Yes' : 'No') : 'Invalid value'),
    date: (input) =>
      typeof input === 'string' ? (formatCalendarDate(input) ?? 'Invalid value') : 'Invalid value',
    single_select: (input) => (typeof input === 'string' ? option(input) : 'Invalid value'),
    multi_select: (input) =>
      Array.isArray(input) ? input.map(option).join(', ') : 'Invalid value',
  };
  const empty =
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && !value.length);
  const formatted = empty ? 'Not set' : formatters[field.type](value);
  const label = `${field.name}: ${formatted}`;

  return <Chip label={label} size="small" title={label} variant="outlined" />;
}
