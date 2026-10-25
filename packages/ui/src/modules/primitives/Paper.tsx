'use client';
import MuiPaper from '@mui/material/Paper';
import { styled } from '@mui/material/styles';

import { designTokens } from '../theme/tokens.js';

export const Paper = styled(MuiPaper, { name: 'FlowboardPaper', slot: 'Root' })({
  backgroundImage: 'none',
  borderRadius: designTokens.radius.surface,
}) as typeof MuiPaper;
