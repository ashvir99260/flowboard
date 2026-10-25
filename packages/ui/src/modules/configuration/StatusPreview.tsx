'use client';

import { default as Alert } from '@mui/material/Alert';
import { default as Stack } from '@mui/material/Stack';
import { default as Typography } from '@mui/material/Typography';

import { StatusChip } from '../tasks/StatusChip.js';

import type { ResolvedStatus } from '@flowboard/contracts';

export function StatusPreview({
  items,
  errors = [],
  label = 'Effective status preview',
}: {
  errors?: readonly string[];
  items: readonly ResolvedStatus[];
  label?: string;
}) {
  return (
    <Stack component="section" aria-label={label} spacing={0.8}>
      <Typography component="h2" variant="h3">
        {label}
      </Typography>
      {errors.length ? (
        <Alert severity="error">{errors.join(' ')}</Alert>
      ) : (
        <Stack direction="row" spacing={0.4} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {items.map((status) => (
            <StatusChip key={status.id} status={status} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
