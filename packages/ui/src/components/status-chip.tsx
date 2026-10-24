'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';

import type { ResolvedStatus, StatusCategory } from '@flowboard/contracts';

const categories: Record<StatusCategory, string> = {
  not_started: 'Not started',
  active: 'Active',
  done: 'Done',
  closed: 'Closed',
};

export function StatusChip({
  status,
}: Readonly<{ status: Pick<ResolvedStatus, 'category' | 'color' | 'name'> }>) {
  const label = `${status.name} · ${categories[status.category]}`;

  return (
    <Chip
      icon={
        <Box
          aria-hidden="true"
          component="span"
          sx={{
            bgcolor: status.color,
            border: '1px solid',
            borderColor: 'text.secondary',
            borderRadius: '50%',
            height: 8,
            width: 8,
          }}
        />
      }
      label={label}
      size="small"
      title={label}
      variant="outlined"
      sx={{ color: 'text.primary', maxWidth: '100%' }}
    />
  );
}
