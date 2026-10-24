'use client';

import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';

import type { ReactNode } from 'react';

export function ErrorState({
  action,
  description,
  title,
}: Readonly<{ action?: ReactNode; description: string; title: string }>) {
  return (
    <Alert
      severity="error"
      icon={false}
      aria-label={title}
      action={action}
      sx={{
        display: 'block',
        '& .MuiAlert-message': { minWidth: 0 },
        '& .MuiAlert-action': { m: 0, p: 0, pt: 2, display: 'block' },
        '& .MuiButton-root': { maxWidth: '100%', whiteSpace: 'normal', textAlign: 'left' },
      }}
    >
      <AlertTitle>{title}</AlertTitle>
      {description}
    </Alert>
  );
}
