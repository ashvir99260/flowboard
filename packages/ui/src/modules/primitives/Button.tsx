'use client';
import MuiButton from '@mui/material/Button';
import { styled } from '@mui/material/styles';

import { designTokens } from '../theme/tokens.js';

export const Button = styled(MuiButton, { name: 'FlowboardButton', slot: 'Root' })(({ theme }) => ({
  minHeight: designTokens.controlHeight,
  '@media (pointer: coarse)': { minHeight: designTokens.touchControlHeight },
  borderRadius: theme.shape.borderRadius,
  boxShadow: 'none',
  fontWeight: 500,
  lineHeight: '2rem',
  padding: theme.spacing(0.7, 1.2),
  '&:hover': { boxShadow: 'none' },
})) as typeof MuiButton;
