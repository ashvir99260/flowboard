'use client';
import { useId } from 'react';

import { Stack, Typography } from '../../primitives.js';
import { Toolbar } from '../layout/toolbar.js';

import type { ReactNode } from 'react';

export function ActivityPanel({
  actions,
  children,
}: Readonly<{ actions?: ReactNode; children: ReactNode }>) {
  const id = useId();

  return (
    <Stack component="section" aria-labelledby={id} spacing={0.8}>
      <Toolbar.Root>
        <Typography component="h3" variant="h3" id={id}>
          Activity
        </Typography>
        {actions}
      </Toolbar.Root>
      {children}
    </Stack>
  );
}
