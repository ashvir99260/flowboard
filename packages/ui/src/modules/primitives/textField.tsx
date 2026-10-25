'use client';
import { styled } from '@mui/material/styles';
import MuiTextField from '@mui/material/TextField';

export const TextField = styled(MuiTextField, { name: 'FlowboardTextField', slot: 'Root' })({
  minWidth: 0,
}) as typeof MuiTextField;
