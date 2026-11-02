'use client';

import Skeleton from '@mui/material/Skeleton';
import { styled } from '@mui/material/styles';

export const SkeletonBlock = styled(Skeleton, { name: 'FlowboardSkeleton', slot: 'Block' })(
  ({ theme }) => ({
    backgroundColor: (theme.vars ?? theme).palette.action.hover,
    transform: 'none',
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
      '&::after': { animation: 'none' },
    },
  }),
);
