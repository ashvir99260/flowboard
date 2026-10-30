'use client';

import { styled } from '@mui/material/styles';

import { SettingsListItem } from './SettingsListItem.js';

import type { SettingsListItemProps } from './SettingsListItem.js';
import type { ComponentPropsWithRef, ComponentType } from 'react';

const Root = styled('ul', { name: 'FlowboardSettingsList' })(({ theme }) => ({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  borderTop: `1px solid ${(theme.vars ?? theme).palette.divider}`,
}));

export const SettingsList: {
  Item: ComponentType<SettingsListItemProps>;
  Root: ComponentType<ComponentPropsWithRef<'ul'>>;
} = { Root, Item: SettingsListItem };
