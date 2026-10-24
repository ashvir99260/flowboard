'use client';

import { styled } from '@mui/material/styles';

import { Box, Button, Drawer, useMediaQuery } from '../primitives.js';

import type { ReactNode } from 'react';

const Root = styled('div', { name: 'FlowboardWorkspace', slot: 'Root' })({
  display: 'flex',
  minHeight: '100dvh',
});
const Sidebar = styled(Drawer, { name: 'FlowboardWorkspace', slot: 'Sidebar' })(({ theme }) => ({
  width: 0,
  flexShrink: 0,
  [theme.breakpoints.up('md')]: { width: 272 },
  '& .MuiDrawer-paper': { width: 272, maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box' },
}));
const Navigation = styled('nav', { name: 'FlowboardWorkspace', slot: 'Navigation' })(
  ({ theme }) => ({
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
  }),
);
const Content = styled('div')({ flex: 1, minWidth: 0 });
const Main = styled('main', { name: 'FlowboardWorkspace', slot: 'Main' })(({ theme }) => ({
  padding: theme.spacing(4),
  [theme.breakpoints.up('md')]: { padding: theme.spacing(8) },
}));

export function WorkspaceLayout({
  children,
  navigation,
  open,
  onOpen,
  onClose,
}: Readonly<{
  children: ReactNode;
  navigation: ReactNode;
  onClose: () => void;
  onOpen: () => void;
  open: boolean;
}>) {
  const desktop = useMediaQuery((theme) => theme.breakpoints.up('md'));

  return (
    <Root>
      <Sidebar
        open={desktop || open}
        variant={desktop ? 'permanent' : 'temporary'}
        onClose={onClose}
      >
        <Navigation aria-label="Workspace navigation">
          {!desktop && <Button onClick={onClose}>Close navigation</Button>}
          {navigation}
        </Navigation>
      </Sidebar>
      <Content>
        {!desktop && (
          <Box sx={{ p: 3 }}>
            <Button onClick={onOpen}>Open navigation</Button>
          </Box>
        )}
        <Main>{children}</Main>
      </Content>
    </Root>
  );
}
