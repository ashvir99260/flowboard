'use client';
import MuiChip from '@mui/material/Chip';
import { styled } from '@mui/material/styles';

export const Chip = styled(MuiChip, { name: 'FlowboardChip', slot: 'Root' })(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  fontWeight: 500,
  maxWidth: '100%',
})) as typeof MuiChip;
