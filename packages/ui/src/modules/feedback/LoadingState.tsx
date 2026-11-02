'use client';

import { styled } from '@mui/material/styles';

import { SkeletonBlock } from './SkeletonBlock.js';
import { SkeletonRegion } from './SkeletonRegion.js';

import type { ReactNode } from 'react';

const Root = styled('div', { name: 'FlowboardLoading', slot: 'Root' })(({ theme }) => ({
  display: 'grid',
  gap: theme.spacing(1.2),
  padding: theme.spacing(1.6),
  minHeight: '8rem',
}));

type LoadingStateProps = Readonly<{ children: ReactNode }>;

export function LoadingState({ children }: LoadingStateProps) {
  return (
    <SkeletonRegion label={children}>
      <Root>
        <SkeletonBlock height="1.4rem" width="65%" />
        <SkeletonBlock height="1.4rem" width="85%" />
        <SkeletonBlock height="1.4rem" width="50%" />
      </Root>
    </SkeletonRegion>
  );
}
