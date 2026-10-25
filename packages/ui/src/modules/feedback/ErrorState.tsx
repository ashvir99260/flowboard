'use client';

import { default as Alert } from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import { styled } from '@mui/material/styles';

import type { ReactNode } from 'react';

const Root = styled(Alert, { name: 'FlowboardErrorState', slot: 'Root' })(({ theme }) => ({
  display: 'block',
  '& .MuiAlert-message': { minWidth: 0 },
  '& .MuiAlert-action': { margin: 0, padding: 0, paddingTop: theme.spacing(0.8), display: 'block' },
  '& .MuiButton-root': { maxWidth: '100%', whiteSpace: 'normal', textAlign: 'left' },
}));

export function ErrorState({
  action,
  description,
  title,
}: Readonly<{ action?: ReactNode; description: string; title: string }>) {
  return (
    <Root severity="error" icon={false} aria-label={title} action={action}>
      <AlertTitle>{title}</AlertTitle>
      {description}
    </Root>
  );
}
