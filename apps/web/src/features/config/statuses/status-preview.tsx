'use client';

import { StatusChip } from '@flowboard/ui';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

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
    <Stack component="section" aria-label={label} spacing={2}>
      <Typography component="h2" variant="h3">
        {label}
      </Typography>
      {errors.length ? (
        <Alert severity="error">{errors.join(' ')}</Alert>
      ) : (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {items.map((status) => (
            <StatusChip key={status.id} status={status} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
