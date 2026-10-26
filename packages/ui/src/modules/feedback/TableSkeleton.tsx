'use client';

import { styled } from '@mui/material/styles';

import { SkeletonBlock } from './SkeletonBlock.js';
import { SkeletonRegion } from './SkeletonRegion.js';

const Root = styled('div')(({ theme }) => ({
  border: `1px solid ${(theme.vars ?? theme).palette.divider}`,
  borderRadius: 8,
  backgroundColor: (theme.vars ?? theme).palette.background.paper,
  height: 'min(64rem, 75dvh)',
  minHeight: '28rem',
  overflow: 'hidden',
}));
const Row = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(16rem, 2fr) repeat(6, minmax(7rem, 1fr))',
  alignItems: 'center',
  minWidth: '70rem',
  minHeight: '4.8rem',
  gap: theme.spacing(2.4),
  paddingInline: theme.spacing(1.6),
  borderBottom: `1px solid ${(theme.vars ?? theme).palette.divider}`,
  '&:first-of-type': { backgroundColor: (theme.vars ?? theme).palette.action.hover },
}));

export function TableSkeleton({ label = 'Loading tasks…' }: Readonly<{ label?: string }>) {
  return (
    <SkeletonRegion label={label}>
      <Root>
        {[1, 2, 3, 4, 5, 6].map((row) => (
          <Row key={row}>
            {[1, 2, 3, 4, 5, 6, 7].map((cell) => (
              <SkeletonBlock key={cell} width={cell === 1 ? '75%' : '85%'} height="1.4rem" />
            ))}
          </Row>
        ))}
      </Root>
    </SkeletonRegion>
  );
}
