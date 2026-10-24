'use client';

import { styled } from '@mui/material/styles';

import { CircularProgress, Typography } from '../primitives.js';

import type { ReactNode } from 'react';

const Root = styled('div', { name: 'FlowboardLoading', slot: 'Root' })(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.2),
  padding: theme.spacing(2.4),
}));

export function LoadingState({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Root role="status">
      <CircularProgress aria-hidden="true" size={'2rem'} />
      <Typography>{children}</Typography>
    </Root>
  );
}
