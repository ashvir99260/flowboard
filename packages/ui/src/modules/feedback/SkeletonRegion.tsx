'use client';

import { styled } from '@mui/material/styles';

import type { ReactNode } from 'react';

const Root = styled('div')({ minWidth: 0, width: '100%' });
const Label = styled('span')({
  position: 'absolute',
  width: '0.1rem',
  height: '0.1rem',
  padding: 0,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
});

export function SkeletonRegion({
  children,
  label,
}: Readonly<{ children: ReactNode; label: ReactNode }>) {
  return (
    <Root>
      <Label role="status" aria-label={typeof label === 'string' ? label : undefined}>
        {label}
      </Label>
      <div aria-busy="true" aria-hidden="true">
        {children}
      </div>
    </Root>
  );
}
