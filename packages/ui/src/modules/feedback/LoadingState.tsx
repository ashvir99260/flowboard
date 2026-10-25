'use client';

import { default as CircularProgress } from '@mui/material/CircularProgress';
import { styled } from '@mui/material/styles';
import { default as Typography } from '@mui/material/Typography';

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
