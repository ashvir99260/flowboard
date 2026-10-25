'use client';

import { styled } from '@mui/material/styles';

import { Box, Button, Drawer, IconButton, useMediaQuery } from '../../primitives.js';
import { WorkspaceIcon } from '../navigation/workspaceIcon.js';
import { designTokens } from '../theme/tokens.js';

import type { ReactNode } from 'react';

const Root = styled('div', { name: 'FlowboardWorkspace', slot: 'Root' })({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100dvh',
});
const Header = styled('header', { name: 'FlowboardWorkspace', slot: 'Header' })(({ theme }) => ({
  alignItems: 'center',
  backgroundColor: (theme.vars ?? theme).palette.background.paper,
  borderBottom: `1px solid ${(theme.vars ?? theme).palette.divider}`,
  boxSizing: 'border-box',
  display: 'flex',
  gap: theme.spacing(1.6),
  height: designTokens.layout.headerHeight,
  paddingInline: theme.spacing(1.6),
  position: 'sticky',
  top: 0,
  zIndex: theme.zIndex.appBar,
  [theme.breakpoints.up('md')]: { paddingInline: theme.spacing(2.4) },
}));
const HeaderContent = styled('div')(({ theme }) => ({
  alignItems: 'center',
  display: 'flex',
  flex: 1,
  gap: theme.spacing(1.6),
  minWidth: 0,
}));
const HeaderActions = styled('div')(({ theme }) => ({
  alignItems: 'center',
  display: 'flex',
  flexShrink: 0,
  gap: theme.spacing(0.8),
}));
const Body = styled('div')({ display: 'flex', flex: 1, minWidth: 0 });
const Sidebar = styled(Drawer, {
  name: 'FlowboardWorkspace',
  shouldForwardProp: (property) => property !== 'hasHeader',
  slot: 'Sidebar',
})<{ hasHeader: boolean }>(({ hasHeader, theme }) => ({
  width: 0,
  flexShrink: 0,
  [theme.breakpoints.up('md')]: { width: designTokens.layout.sidebarWidth },
  '& .MuiDrawer-paper': {
    backgroundColor: designTokens.palette.light.sidebar,
    width: designTokens.layout.sidebarWidth,
    maxWidth: 'calc(100vw - 3.2rem)',
    boxSizing: 'border-box',
    ...theme.applyStyles('dark', { backgroundColor: designTokens.palette.dark.sidebar }),
    [theme.breakpoints.up('md')]: hasHeader
      ? {
          top: designTokens.layout.headerHeight,
          height: `calc(100% - ${designTokens.layout.headerHeight})`,
        }
      : {},
  },
}));
const Navigation = styled('nav', { name: 'FlowboardWorkspace', slot: 'Navigation' })(
  ({ theme }) => ({
    boxSizing: 'border-box',
    padding: theme.spacing(1.6, 1.2),
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
  }),
);
const Content = styled('div')({ flex: 1, minWidth: 0 });
const Main = styled('main', { name: 'FlowboardWorkspace', slot: 'Main' })(({ theme }) => ({
  padding: theme.spacing(1.6),
  [theme.breakpoints.up('md')]: { padding: theme.spacing(2.4) },
}));

export function WorkspaceLayout({
  children,
  header,
  headerActions,
  navigation,
  open,
  onOpen,
  onClose,
}: Readonly<{
  children: ReactNode;
  header?: ReactNode;
  headerActions?: ReactNode;
  navigation: ReactNode;
  onClose: () => void;
  onOpen: () => void;
  open: boolean;
}>) {
  const desktop = useMediaQuery((theme) => theme.breakpoints.up('md'));
  const hasHeader = header !== undefined || headerActions !== undefined;

  return (
    <Root>
      {hasHeader && (
        <Header>
          {!desktop && (
            <IconButton aria-label="Open navigation" onClick={onOpen}>
              <WorkspaceIcon name="menu" />
            </IconButton>
          )}
          <HeaderContent>{header}</HeaderContent>
          {headerActions && <HeaderActions>{headerActions}</HeaderActions>}
        </Header>
      )}
      <Body>
        <Sidebar
          hasHeader={hasHeader}
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
          {!desktop && !hasHeader && (
            <Box sx={{ p: 1.2 }}>
              <Button onClick={onOpen}>Open navigation</Button>
            </Box>
          )}
          <Main>{children}</Main>
        </Content>
      </Body>
    </Root>
  );
}
