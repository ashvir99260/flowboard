'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { StatusChip } from './status-chip.js';

import type { ResolvedStatus } from '@flowboard/contracts';
import type { ReactNode } from 'react';

export function KanbanColumn({
  action,
  children,
  count,
  status,
}: Readonly<{
  action?: ReactNode;
  children?: ReactNode;
  count: number;
  status: Pick<ResolvedStatus, 'name' | 'category' | 'color'>;
}>) {
  return (
    <Paper
      component="section"
      aria-label={`${status.name} column`}
      variant="outlined"
      sx={{ p: 3, minWidth: 0, width: '100%' }}
    >
      <Stack
        direction="row"
        useFlexGap
        spacing={2}
        sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', mb: 3 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <StatusChip status={status} />
          <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
            {count} loaded {count === 1 ? 'task' : 'tasks'}
          </Typography>
        </Box>
        {action}
      </Stack>
      <Stack spacing={3}>{children}</Stack>
    </Paper>
  );
}
