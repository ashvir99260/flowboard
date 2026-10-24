'use client';
import { styled } from '@mui/material/styles';

import type { BoardPart } from './boardTypes.js';

export const BoardDropzone: BoardPart = styled('div', { name: 'FlowboardBoard', slot: 'Dropzone' })(
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
