'use client';

import { styled } from '@mui/material/styles';

import { BoardGrid } from '../board/BoardGrid.js';
import { BoardViewport } from '../board/BoardViewport.js';

import { SkeletonBlock } from './SkeletonBlock.js';
import { SkeletonRegion } from './SkeletonRegion.js';

const Toolbar = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  minHeight: '3.6rem',
  marginBottom: theme.spacing(1.2),
}));
const Column = styled('div')(({ theme }) => ({
  backgroundColor: (theme.vars ?? theme).palette.background.default,
  border: `1px solid ${(theme.vars ?? theme).palette.divider}`,
  borderRadius: 8,
  padding: theme.spacing(1.2),
  minHeight: '36rem',
}));
const Header = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.8),
  minHeight: '3.6rem',
  marginBottom: theme.spacing(1.2),
  borderBottom: `1px solid ${(theme.vars ?? theme).palette.divider}`,
}));
const Card = styled('div')(({ theme }) => ({
  display: 'grid',
  gap: theme.spacing(1.2),
  backgroundColor: (theme.vars ?? theme).palette.background.paper,
  border: `1px solid ${(theme.vars ?? theme).palette.divider}`,
  borderRadius: 8,
  padding: theme.spacing(1.2),
  marginBottom: theme.spacing(1.2),
  minHeight: '8.4rem',
}));

export function BoardSkeleton({ label = 'Loading board…' }: Readonly<{ label?: string }>) {
  return (
    <SkeletonRegion label={label}>
      <Toolbar>
        <SkeletonBlock height="1.6rem" width="12rem" />
        <SkeletonBlock height="3.6rem" width="3.6rem" />
      </Toolbar>
      <BoardViewport>
        <BoardGrid>
          {[1, 2, 3].map((column) => (
            <Column key={column}>
              <Header>
                <SkeletonBlock height="2rem" width="10rem" />
                <SkeletonBlock height="2rem" width="2rem" />
              </Header>
              {[1, 2, 3].map((card) => (
                <Card key={card}>
                  <SkeletonBlock height="1.4rem" width="85%" />
                  <SkeletonBlock height="1.4rem" width="62%" />
                  <SkeletonBlock height="2rem" width="8rem" />
                </Card>
              ))}
            </Column>
          ))}
        </BoardGrid>
      </BoardViewport>
    </SkeletonRegion>
  );
}
