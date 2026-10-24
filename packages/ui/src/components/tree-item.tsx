'use client';

import ButtonBase from '@mui/material/ButtonBase';
import { styled } from '@mui/material/styles';
import { useId } from 'react';

import type { NodeType } from '@flowboard/contracts';
import type { ReactNode } from 'react';

const Item = styled('li')({ listStyle: 'none', minWidth: 0 });
const Row = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  borderRadius: 4,
  '&[data-selected="true"]': { backgroundColor: (theme.vars ?? theme).palette.action.selected },
}));
const Toggle = styled(ButtonBase)({ minWidth: 44, minHeight: 44 });
const Select = styled(ButtonBase)(({ theme }) => ({
  minHeight: 44,
  padding: theme.spacing(2),
  textAlign: 'left',
  justifyContent: 'flex-start',
  flex: 1,
  minWidth: 0,
  gap: theme.spacing(2),
}));
const Icon = styled('span')(({ theme }) => ({
  color: (theme.vars ?? theme).palette.text.secondary,
}));
const Label = styled('span')({ overflowWrap: 'anywhere' });
const Children = styled('ul')(({ theme }) => ({ paddingLeft: theme.spacing(4), margin: 0 }));

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
            <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
          </Toggle>
        )}
        <Select aria-current={selected ? 'page' : undefined} onClick={onSelect} title={name}>
          <Icon aria-hidden="true">{type === 'list' ? '≡' : '▱'}</Icon>
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
