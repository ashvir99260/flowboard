'use client';

import ButtonBase from '@mui/material/ButtonBase';
import { styled } from '@mui/material/styles';

import { WorkspaceIcon } from '../navigation/WorkspaceIcon.js';

import type { ComponentPropsWithRef, ReactNode } from 'react';

const Row = styled(ButtonBase)(({ theme }) => ({
  display: 'flex',
  width: '100%',
  gap: theme.spacing(1.2),
  padding: theme.spacing(1.6, 1.2),
  justifyContent: 'flex-start',
  textAlign: 'left',
  color: (theme.vars ?? theme).palette.text.primary,
  borderBottom: `1px solid ${(theme.vars ?? theme).palette.divider}`,
  '&:hover': { backgroundColor: (theme.vars ?? theme).palette.action.hover },
  '&[aria-pressed="true"]': { backgroundColor: (theme.vars ?? theme).palette.action.selected },
  '&.Mui-focusVisible': {
    outline: `2px solid ${(theme.vars ?? theme).palette.primary.main}`,
    outlineOffset: -2,
  },
  '&.Mui-disabled': { opacity: 0.55 },
}));
const Content = styled('span')({ display: 'grid', gap: '0.4rem', flex: 1, minWidth: 0 });
const Title = styled('span')({ fontWeight: 600, overflowWrap: 'anywhere' });
const Description = styled('span')(({ theme }) => ({
  color: (theme.vars ?? theme).palette.text.secondary,
  fontSize: '1.2rem',
  overflowWrap: 'anywhere',
}));
export type SettingsListItemProps = Omit<ComponentPropsWithRef<'button'>, 'title'> & {
  description?: ReactNode;
  itemLabel?: string;
  selected?: boolean;
  title: ReactNode;
};

export function SettingsListItem({
  description,
  itemLabel,
  selected = false,
  title,
  children,
  ...props
}: SettingsListItemProps) {
  return (
    <li aria-label={itemLabel}>
      <Row {...props} aria-pressed={selected}>
        <Content>
          <Title>{title}</Title>
          {description && <Description>{description}</Description>}
          {children}
        </Content>
        <WorkspaceIcon name="chevronRight" />
      </Row>
    </li>
  );
}
