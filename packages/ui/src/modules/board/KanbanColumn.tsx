'use client';

import { styled } from '@mui/material/styles';

import { default as Box } from '@mui/material/Box';
import { default as Stack } from '@mui/material/Stack';
import { default as Typography } from '@mui/material/Typography';
import { Paper } from '../primitives/Paper.js';
import { StatusChip } from '../tasks/StatusChip.js';

import type { ResolvedStatus } from '@flowboard/contracts';
import type { ReactNode } from 'react';

const Column = styled(Paper, { name: 'FlowboardKanbanColumn', slot: 'Root' })(({ theme }) => ({
  padding: theme.spacing(0.4),
  minWidth: 0,
  width: '100%',
  backgroundColor: 'transparent',
  borderColor: 'transparent',
})) as typeof Paper;
const Header = styled(Stack)(({ theme }) => ({
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  marginBottom: theme.spacing(1.6),
}));
const Summary = styled(Box)({ minWidth: 0 });
const Count = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.6),
  fontSize: '1.2rem',
}));

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
    <Column component="section" aria-label={`${status.name} column`} variant="outlined">
      <Header direction="row" useFlexGap spacing={0.8}>
        <Summary>
          <StatusChip status={status} />
          <Count color="text.secondary" variant="body2">
            {count} loaded {count === 1 ? 'task' : 'tasks'}
          </Count>
        </Summary>
        {action}
      </Header>
      <Stack spacing={1.2}>{children}</Stack>
    </Column>
  );
}
