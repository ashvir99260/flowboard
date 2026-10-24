'use client';

import { styled } from '@mui/material/styles';

import { Paper, Typography } from './primitives.js';

import type { ComponentPropsWithRef, ComponentType, ReactNode } from 'react';

const SurfaceRoot = styled(Paper, { name: 'FlowboardSurface', slot: 'Root' })(({ theme }) => ({
  border: `1px solid ${(theme.vars ?? theme).palette.divider}`,
  minWidth: 0,
  overflowWrap: 'anywhere',
}));
const SurfaceHeader = styled('header', { name: 'FlowboardSurface', slot: 'Header' })(
  ({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.8),
    padding: theme.spacing(2.4, 2.4, 0),
  }),
);
const SurfaceTitle = styled(Typography, { name: 'FlowboardSurface', slot: 'Title' })({
  fontSize: '1.8rem',
  fontWeight: 600,
  lineHeight: 1.5,
}) as typeof Typography;
const SurfaceDescription = styled('p', { name: 'FlowboardSurface', slot: 'Description' })(
  ({ theme }) => ({
    color: (theme.vars ?? theme).palette.text.secondary,
    fontSize: '1.4rem',
    lineHeight: 1.5,
    margin: 0,
  }),
);
const SurfaceBody = styled('div', { name: 'FlowboardSurface', slot: 'Body' })(({ theme }) => ({
  minWidth: 0,
  padding: theme.spacing(2.4),
}));
const SurfaceFooter = styled('footer', { name: 'FlowboardSurface', slot: 'Footer' })(
  ({ theme }) => ({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.8),
    alignItems: 'center',
    padding: theme.spacing(0, 2.4, 2.4),
  }),
);

export const Surface: {
  Body: ComponentType<ComponentPropsWithRef<'div'>>;
  Description: ComponentType<ComponentPropsWithRef<'p'>>;
  Footer: ComponentType<ComponentPropsWithRef<'footer'>>;
  Header: ComponentType<ComponentPropsWithRef<'header'>>;
  Root: typeof Paper;
  Title: typeof Typography;
} = {
  Root: SurfaceRoot as typeof Paper,
  Header: SurfaceHeader,
  Title: SurfaceTitle,
  Description: SurfaceDescription,
  Body: SurfaceBody,
  Footer: SurfaceFooter,
};

const ToolbarRoot = styled('div', { name: 'FlowboardToolbar', slot: 'Root' })(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: theme.spacing(1.2),
  minWidth: 0,
}));
const ToolbarGroup = styled('div', { name: 'FlowboardToolbar', slot: 'Group' })(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.spacing(0.8),
  minWidth: 0,
}));

export const Toolbar: {
  Group: ComponentType<ComponentPropsWithRef<'div'>>;
  Root: ComponentType<ComponentPropsWithRef<'div'>>;
} = { Root: ToolbarRoot, Group: ToolbarGroup };

const AuthRoot = styled('main', { name: 'FlowboardAuthPanel', slot: 'Root' })(({ theme }) => ({
  minHeight: '100dvh',
  display: 'grid',
  placeItems: 'center',
  padding: theme.spacing(1.6),
}));
const AuthSurface = styled(SurfaceRoot)({ width: '100%', maxWidth: '42rem' });

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
        <SurfaceHeader>
          <Typography color="text.secondary" variant="overline">
            Flowboard
          </Typography>
          <SurfaceTitle component="h1">{title}</SurfaceTitle>
          {description && <SurfaceDescription>{description}</SurfaceDescription>}
        </SurfaceHeader>
        <SurfaceBody>{children}</SurfaceBody>
      </AuthSurface>
    </AuthRoot>
  );
}
