'use client';

import { styled } from '@mui/material/styles';

import type { ReactNode } from 'react';

const Root = styled('div', { name: 'FlowboardSettingsLayout' })(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: theme.spacing(2.4),
  alignItems: 'start',
  minWidth: 0,
  '& > *': { minWidth: 0 },
  '& > [data-settings-detail]': { gridRow: 1 },
  [theme.breakpoints.up('md')]: {
    '&[data-editing="true"]': { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 48rem)' },
    '& > [data-settings-detail]': { gridColumn: 2, gridRow: 1 },
  },
}));

export function SettingsLayout({
  collection,
  detail,
}: {
  collection: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <Root data-editing={Boolean(detail)}>
      <div>{collection}</div>
      {detail && <div data-settings-detail>{detail}</div>}
    </Root>
  );
}
