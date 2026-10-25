'use client';
import MuiChip from '@mui/material/Chip';
import { styled } from '@mui/material/styles';

export const Chip = styled(MuiChip, { name: 'FlowboardChip', slot: 'Root' })(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  fontWeight: 500,
  maxWidth: '100%',
  height: '2.4rem',
  fontSize: '1.2rem',
  '& .MuiChip-label': { padding: theme.spacing(0, 0.8) },
})) as typeof MuiChip;
