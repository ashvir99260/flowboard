'use client';

import { styled } from '@mui/material/styles';

import { CircularProgress, Typography } from '../primitives.js';

import type { ReactNode } from 'react';

const Root = styled('div', { name: 'FlowboardLoading', slot: 'Root' })(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(3),
  padding: theme.spacing(6),
}));

export function LoadingState({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Root role="status">
      <CircularProgress aria-hidden="true" size={20} />
      <Typography>{children}</Typography>
    </Root>
  );
}
