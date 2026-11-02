'use client';

import { styled } from '@mui/material/styles';

import { SkeletonBlock } from './SkeletonBlock.js';
import { SkeletonRegion } from './SkeletonRegion.js';

const Root = styled('div')(({ theme }) => ({
  display: 'grid',
  gap: theme.spacing(1.8),
  minHeight: '26rem',
  paddingBlock: theme.spacing(1.6),
}));

export function NavigationSkeleton() {
  return (
    <SkeletonRegion label="Loading navigation…">
      <Root>
        {[80, 65, 72, 60, 78, 68].map((width) => (
          <SkeletonBlock key={width} width={`${width}%`} height="1.6rem" />
        ))}
      </Root>
    </SkeletonRegion>
  );
}
