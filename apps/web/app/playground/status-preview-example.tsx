'use client';

import { ResolvedStatusSchema } from '@flowboard/contracts';
import { Stack } from '@flowboard/ui';

import { StatusPreview } from '../../src/features/config/statuses/status-preview';

// Isolated presentational examples; no API requests or persisted configuration.
const example = ResolvedStatusSchema.parse(ResolvedStatusSchema.meta()?.example);
const items = [
  example,
  ResolvedStatusSchema.parse({
    ...example,
    id: '20000000-0000-4000-8000-000000000101',
    key: 'doing',
    name: 'In progress',
    category: 'active',
  }),
  ResolvedStatusSchema.parse({
    ...example,
    id: '20000000-0000-4000-8000-000000000102',
    key: 'done',
    name: 'Done',
    category: 'done',
  }),
];

export function StatusPreviewExample() {
  return (
    <Stack spacing={3}>
      <StatusPreview label="Valid configuration example" items={items} />
      <StatusPreview
        label="Invalid configuration example"
        items={[]}
        errors={['At least one active status is required.']}
      />
    </Stack>
  );
}
