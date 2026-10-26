'use client';

import { default as Box } from '@mui/material/Box';
import { default as Stack } from '@mui/material/Stack';
import { styled } from '@mui/material/styles';
import { default as Typography } from '@mui/material/Typography';

import { Paper } from '../primitives/Paper.js';

import { LoadedTaskCount } from './LoadedTaskCount.js';

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
  minHeight: '4.4rem',
  paddingBottom: theme.spacing(0.8),
}));
const Title = styled(Typography)({
  minWidth: 0,
  fontSize: '1.3rem',
  fontWeight: 650,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}) as typeof Typography;
const Summary = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.8),
  minWidth: 0,
}));

export function WorkspaceColumn({
  actions,
  children,
  count,
  name,
}: Readonly<WorkspaceColumnProps>) {
  return (
    <Column component="section" aria-label={`${name} list column`}>
      <Header direction="row" spacing={0.8}>
        <Summary>
          <Title component="h2" title={name}>
            {name}
          </Title>
          <LoadedTaskCount count={count} />
        </Summary>
        {actions}
      </Header>
      <Stack spacing={1.2}>{children}</Stack>
    </Column>
  );
}
