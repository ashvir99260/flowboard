'use client';

import { default as Box } from '@mui/material/Box';
import { default as Stack } from '@mui/material/Stack';
import { styled } from '@mui/material/styles';

import { Paper } from '../primitives/Paper.js';
import { StatusChip } from '../tasks/StatusChip.js';

import { LoadedTaskCount } from './LoadedTaskCount.js';

import type { ResolvedStatus } from '@flowboard/contracts';
import type { ReactNode } from 'react';

const Column = styled(Paper, { name: 'FlowboardKanbanColumn', slot: 'Root' })(({ theme }) => ({
  padding: theme.spacing(1),
  borderRadius: 8,
  height: '100%',
  minWidth: 0,
  width: '100%',
  backgroundColor: (theme.vars ?? theme).palette.background.default,
  borderColor: (theme.vars ?? theme).palette.divider,
})) as typeof Paper;
const Header = styled(Stack)(({ theme }) => ({
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'nowrap',
  marginBottom: theme.spacing(1.2),
  minHeight: '4.4rem',
  paddingBottom: theme.spacing(1),
  borderBottom: `1px solid ${(theme.vars ?? theme).palette.divider}`,
}));
const Summary = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.8),
  minWidth: 0,
  '& .MuiChip-root': { minWidth: 0, maxWidth: '100%' },
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
          <StatusChip detail="name" status={status} />
          <LoadedTaskCount count={count} />
        </Summary>
        {action}
      </Header>
      <Stack spacing={1.2}>{children}</Stack>
    </Column>
  );
}
