'use client';

import { Paper, Typography } from '@flowboard/ui';

import type { ReactNode } from 'react';

export function PlaygroundSection({
  children,
  description,
  title,
}: Readonly<{ children: ReactNode; description: string; title: string }>) {
  return (
    <Paper component="section" variant="outlined" sx={{ p: 2.4, minWidth: 0, borderRadius: 2 }}>
      <Typography component="h2" variant="h3">
        {title}
      </Typography>
      <Typography color="text.secondary" variant="body2" sx={{ mt: 0.4, mb: 2 }}>
        {description}
      </Typography>
      {children}
    </Paper>
  );
}
