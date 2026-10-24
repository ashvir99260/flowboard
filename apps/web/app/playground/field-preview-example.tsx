'use client';

import { ResolvedFieldSchema } from '@flowboard/contracts';

import { FieldPreview } from '../../src/features/config/fields/field-preview';

// Isolated sample props for the development-only playground; no API or persisted data.
const example = ResolvedFieldSchema.parse(ResolvedFieldSchema.meta()?.example);
const fields = (['number', 'checkbox'] as const).map((type, index) =>
  ResolvedFieldSchema.parse({
    ...example,
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    key: `preview_${type}`,
    name: type === 'number' ? 'Preview effort' : 'Preview approval',
    type,
    required: true,
    options: [],
    position: index,
  }),
);

export function FieldPreviewExample() {
  return <FieldPreview items={fields} />;
}
