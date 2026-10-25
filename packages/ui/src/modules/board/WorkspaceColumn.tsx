'use client';

import { default as Box } from '@mui/material/Box';
import { default as Stack } from '@mui/material/Stack';
import { styled } from '@mui/material/styles';
import { default as Typography } from '@mui/material/Typography';

import { Paper } from '../primitives/Paper.js';

import type { ReactNode } from 'react';

export type WorkspaceColumnProps = {
  actions?: ReactNode;
  children?: ReactNode;
  count: number;
  name: string;
};

const Column = styled(Paper)(({ theme }) => ({
  backgroundColor: (theme.vars ?? theme).palette.background.default,
  border: `1px solid ${(theme.vars ?? theme).palette.divider}`,
  borderRadius: 8,
  height: '100%',
  minWidth: 0,
  padding: theme.spacing(1),
  width: '100%',
})) as typeof Paper;
const Header = styled(Stack)(({ theme }) => ({
  alignItems: 'center',
  borderBottom: `1px solid ${(theme.vars ?? theme).palette.divider}`,
  justifyContent: 'space-between',
  marginBottom: theme.spacing(1.2),
  minHeight: '5.2rem',
  paddingBottom: theme.spacing(0.8),
}));
const Title = styled(Typography)({
  fontSize: '1.3rem',
  fontWeight: 650,
  overflowWrap: 'anywhere',
}) as typeof Typography;

export function WorkspaceColumn({
  actions,
  children,
  count,
  name,
}: Readonly<WorkspaceColumnProps>) {
  return (
    <Column component="section" aria-label={`${name} list column`}>
      <Header direction="row" spacing={0.8}>
        <Box sx={{ minWidth: 0 }}>
          <Title component="h2">{name}</Title>
          <Typography color="text.secondary" variant="body2">
            {count} loaded {count === 1 ? 'task' : 'tasks'}
          </Typography>
        </Box>
        {actions}
      </Header>
      <Stack spacing={1.2}>{children}</Stack>
    </Column>
  );
}
