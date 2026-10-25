'use client';

import ButtonBase from '@mui/material/ButtonBase';
import { styled } from '@mui/material/styles';
import { useId } from 'react';

import { WorkspaceIcon } from './WorkspaceIcon.js';

import type { NodeType } from '@flowboard/contracts';
import type { ReactNode } from 'react';

const Item = styled('li')({ listStyle: 'none', minWidth: 0 });
const Row = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  borderRadius: theme.shape.borderRadius,
  color: (theme.vars ?? theme).palette.text.secondary,
  '&:hover': { backgroundColor: (theme.vars ?? theme).palette.action.hover },
  '&[data-selected="true"]': {
    backgroundColor: (theme.vars ?? theme).palette.action.selected,
    color: (theme.vars ?? theme).palette.primary.main,
    fontWeight: 600,
  },
}));
const Toggle = styled(ButtonBase)({
  minWidth: '3.2rem',
  minHeight: '3.6rem',
  borderRadius: 6,
  '@media (pointer: coarse)': { minWidth: '4.4rem', minHeight: '4.4rem' },
});
const Select = styled(ButtonBase)(({ theme }) => ({
  minHeight: '3.6rem',
  padding: theme.spacing(0.6, 0.8),
  textAlign: 'left',
  justifyContent: 'flex-start',
  flex: 1,
  minWidth: 0,
  gap: theme.spacing(0.8),
  fontSize: '1.3rem',
  fontWeight: 'inherit',
  borderRadius: theme.shape.borderRadius,
  '@media (pointer: coarse)': { minHeight: '4.4rem' },
}));
const Label = styled('span')({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const Children = styled('ul')(({ theme }) => ({
  borderLeft: `1px solid ${(theme.vars ?? theme).palette.divider}`,
  margin: theme.spacing(0.2, 0, 0.2, 1.6),
  paddingLeft: theme.spacing(0.8),
}));
const typeIcon = { folder: 'folder', list: 'list', space: 'space', workspace: 'board' } as const;

export function TreeItem({
  children,
  expanded = false,
  name,
  onSelect,
  onToggle,
  selected = false,
  type,
}: Readonly<{
  children?: ReactNode;
  expanded?: boolean;
  name: string;
  onSelect: () => void;
  onToggle?: () => void;
  selected?: boolean;
  type: NodeType;
}>) {
  const id = useId();

  return (
    <Item>
      <Row data-selected={selected}>
        {onToggle && (
          <Toggle
            aria-controls={id}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${name}`}
            onClick={onToggle}
          >
            <WorkspaceIcon name={expanded ? 'chevronDown' : 'chevronRight'} />
          </Toggle>
        )}
        <Select aria-current={selected ? 'page' : undefined} onClick={onSelect} title={name}>
          <WorkspaceIcon name={typeIcon[type]} />
          <Label>{name}</Label>
        </Select>
      </Row>
      {onToggle && (
        <Children id={id} hidden={!expanded}>
          {children}
        </Children>
      )}
    </Item>
  );
}
