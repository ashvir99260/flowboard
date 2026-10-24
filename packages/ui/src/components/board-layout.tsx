'use client';

import { styled } from '@mui/material/styles';

import type { ComponentPropsWithRef, ComponentType } from 'react';

type Part = ComponentType<ComponentPropsWithRef<'div'>>;

export const BoardViewport: Part = styled('div', { name: 'FlowboardBoard', slot: 'Viewport' })(
  ({ theme }) => ({
    overflowX: 'auto',
    maxWidth: '100%',
    minWidth: 0,
    paddingBottom: theme.spacing(3),
  }),
);

export const BoardGrid: Part = styled('div', { name: 'FlowboardBoard', slot: 'Grid' })(
  ({ theme }) => ({
    display: 'grid',
    gridAutoFlow: 'column',
    gridAutoColumns: 'minmax(260px, 320px)',
    alignItems: 'start',
    gap: theme.spacing(3),
  }),
);

export const BoardItem: Part = styled('div', { name: 'FlowboardBoard', slot: 'Item' })(
  ({ theme }) => ({ marginBottom: theme.spacing(3) }),
);

export const BoardDropzone: Part = styled('div', { name: 'FlowboardBoard', slot: 'Dropzone' })(
  ({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    minHeight: 160,
    borderRadius: 8,
    '&[data-highlighted="true"]': {
      outline: `2px solid ${(theme.vars ?? theme).palette.primary.main}`,
    },
  }),
);
