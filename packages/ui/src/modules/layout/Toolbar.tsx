'use client';
import { styled } from '@mui/material/styles';

import type { ComponentPropsWithRef, ComponentType } from 'react';

const ToolbarRoot = styled('div', { name: 'FlowboardToolbar', slot: 'Root' })(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: theme.spacing(1.2),
  minWidth: 0,
}));
const ToolbarGroup = styled('div', { name: 'FlowboardToolbar', slot: 'Group' })(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.spacing(0.8),
  minWidth: 0,
}));

export const Toolbar: {
  Group: ComponentType<ComponentPropsWithRef<'div'>>;
  Root: ComponentType<ComponentPropsWithRef<'div'>>;
} = { Root: ToolbarRoot, Group: ToolbarGroup };
