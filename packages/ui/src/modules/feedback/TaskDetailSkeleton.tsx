'use client';

import { styled } from '@mui/material/styles';

import { SkeletonBlock } from './SkeletonBlock.js';
import { SkeletonRegion } from './SkeletonRegion.js';

const Root = styled('div')(({ theme }) => ({ display: 'grid', gap: theme.spacing(2.4) }));
const Fields = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: theme.spacing(1.6),
}));
const Field = styled('div')(({ theme }) => ({ display: 'grid', gap: theme.spacing(0.8) }));

export function TaskDetailSkeleton() {
  return (
    <SkeletonRegion label="Loading task…">
      <Root>
        <SkeletonBlock height="2.4rem" width="75%" />
        <SkeletonBlock height="12rem" width="100%" />
        <Fields>
          {[1, 2, 3, 4, 5, 6].map((field) => (
            <Field key={field}>
              <SkeletonBlock height="1.2rem" width="45%" />
              <SkeletonBlock height="3.6rem" width="100%" />
            </Field>
          ))}
        </Fields>
      </Root>
    </SkeletonRegion>
  );
}
