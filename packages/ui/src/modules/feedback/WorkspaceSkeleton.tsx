'use client';

import { styled } from '@mui/material/styles';

import { designTokens } from '../theme/tokens.js';

import { BoardSkeleton } from './BoardSkeleton.js';
import { NavigationSkeleton } from './NavigationSkeleton.js';
import { SkeletonBlock } from './SkeletonBlock.js';
import { SkeletonRegion } from './SkeletonRegion.js';

const Root = styled('div')(({ theme }) => ({
  minHeight: '100dvh',
  backgroundColor: (theme.vars ?? theme).palette.background.default,
}));
const Header = styled('div')(({ theme }) => ({
  height: designTokens.layout.headerHeight,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingInline: theme.spacing(2.4),
  borderBottom: `1px solid ${(theme.vars ?? theme).palette.divider}`,
  backgroundColor: (theme.vars ?? theme).palette.background.paper,
}));
const Body = styled('div')(({ theme }) => ({
  display: 'grid',
  minHeight: `calc(100dvh - ${designTokens.layout.headerHeight})`,
  gridTemplateColumns: `${designTokens.layout.sidebarWidth} minmax(0, 1fr)`,
  [theme.breakpoints.down('md')]: { gridTemplateColumns: 'minmax(0, 1fr)' },
}));
const Sidebar = styled('div')(({ theme }) => ({
  padding: theme.spacing(2.4, 1.6),
  borderRight: `1px solid ${(theme.vars ?? theme).palette.divider}`,
  [theme.breakpoints.down('md')]: { display: 'none' },
}));
const Main = styled('div')(({ theme }) => ({ minWidth: 0, padding: theme.spacing(2.4) }));

export function WorkspaceSkeleton() {
  return (
    <SkeletonRegion label="Opening Flowboard…">
      <Root>
        <Header>
          <SkeletonBlock height="2.4rem" width="12rem" />
          <SkeletonBlock height="3.6rem" width="32%" />
          <SkeletonBlock height="3.2rem" variant="circular" width="3.2rem" />
        </Header>
        <Body>
          <Sidebar>
            <SkeletonBlock height="3.6rem" width="75%" />
            <NavigationSkeleton />
          </Sidebar>
          <Main>
            <SkeletonBlock width="18rem" height="2.4rem" sx={{ mb: 2.4 }} />
            <BoardSkeleton />
          </Main>
        </Body>
      </Root>
    </SkeletonRegion>
  );
}
