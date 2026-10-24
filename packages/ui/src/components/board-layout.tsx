'use client';

import { styled } from '@mui/material/styles';

import type { ComponentPropsWithRef, ComponentType } from 'react';

type Part = ComponentType<ComponentPropsWithRef<'div'>>;

export const BoardViewport: Part = styled('div', { name: 'FlowboardBoard', slot: 'Viewport' })(
  ({ theme }) => ({
    overflowX: 'auto',
    maxWidth: '100%',
    minWidth: 0,
    paddingBottom: theme.spacing(1.2),
  }),
);

export const BoardGrid: Part = styled('div', { name: 'FlowboardBoard', slot: 'Grid' })(
  ({ theme }) => ({
    display: 'grid',
    gridAutoFlow: 'column',
    gridAutoColumns: 'minmax(26rem, 32rem)',
    alignItems: 'start',
    gap: theme.spacing(1.2),
  }),
);

export const BoardItem: Part = styled('div', { name: 'FlowboardBoard', slot: 'Item' })(
  ({ theme }) => ({ marginBottom: theme.spacing(1.2) }),
);

export const BoardDropzone: Part = styled('div', { name: 'FlowboardBoard', slot: 'Dropzone' })(
  ({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    minHeight: '16rem',
    borderRadius: 8,
    '&[data-highlighted="true"]': {
      outline: `2px solid ${(theme.vars ?? theme).palette.primary.main}`,
    },
  }),
);
