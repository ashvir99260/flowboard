'use client';
import { styled } from '@mui/material/styles';

import type { BoardPart } from './boardTypes.js';

export const BoardViewport: BoardPart = styled('div', { name: 'FlowboardBoard', slot: 'Viewport' })(
  ({ theme }) => ({
    overflowX: 'auto',
    maxWidth: '100%',
    minWidth: 0,
    paddingBottom: theme.spacing(1.2),
  }),
);
