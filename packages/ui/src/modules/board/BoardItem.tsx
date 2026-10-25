'use client';
import { styled } from '@mui/material/styles';

import type { BoardPart } from './boardTypes.js';

export const BoardItem: BoardPart = styled('div', { name: 'FlowboardBoard', slot: 'Item' })(
  ({ theme }) => ({ marginBottom: theme.spacing(1.2) }),
);
