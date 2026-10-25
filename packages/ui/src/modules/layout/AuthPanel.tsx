'use client';
import { styled } from '@mui/material/styles';

import { default as Typography } from '@mui/material/Typography';

import { Surface } from './Surface.js';

import type { ReactNode } from 'react';

const AuthRoot = styled('main', { name: 'FlowboardAuthPanel', slot: 'Root' })(({ theme }) => ({
  minHeight: '100dvh',
  display: 'grid',
  placeItems: 'center',
  padding: theme.spacing(1.6),
}));
const AuthSurface = styled(Surface.Root)({ width: '100%', maxWidth: '42rem' });

export function AuthPanel({
  children,
  description,
  title,
}: Readonly<{
  children: ReactNode;
  description?: string;
  title: string;
}>) {
  return (
    <AuthRoot>
      <AuthSurface>
        <Surface.Header>
          <Typography color="text.secondary" variant="overline">
            Flowboard
          </Typography>
          <Surface.Title component="h1">{title}</Surface.Title>
          {description && <Surface.Description>{description}</Surface.Description>}
        </Surface.Header>
        <Surface.Body>{children}</Surface.Body>
      </AuthSurface>
    </AuthRoot>
  );
}
