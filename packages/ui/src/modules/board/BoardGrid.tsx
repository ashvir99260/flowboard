'use client';
import { styled } from '@mui/material/styles';

import type { BoardPart } from './boardTypes.js';

export const BoardGrid: BoardPart = styled('div', { name: 'FlowboardBoard', slot: 'Grid' })(
  ({ theme }) => ({
    display: 'grid',
    gridAutoFlow: 'column',
    gridAutoColumns: 'minmax(26rem, 32rem)',
    alignItems: 'stretch',
    gap: theme.spacing(1.2),
  }),
);
