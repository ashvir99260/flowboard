'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import { useId } from 'react';

import type { NodeType } from '@flowboard/contracts';
import type { ReactNode } from 'react';

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
    <Box component="li" sx={{ listStyle: 'none', minWidth: 0 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          bgcolor: selected ? 'action.selected' : undefined,
          borderRadius: 1,
        }}
      >
        {onToggle && (
          <ButtonBase
            aria-controls={id}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${name}`}
            onClick={onToggle}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
          </ButtonBase>
        )}
        <ButtonBase
          aria-current={selected ? 'page' : undefined}
          onClick={onSelect}
          title={name}
          sx={{
            minHeight: 44,
            p: 2,
            textAlign: 'left',
            justifyContent: 'flex-start',
            flex: 1,
            minWidth: 0,
            gap: 2,
          }}
        >
          <Box component="span" aria-hidden="true" sx={{ color: 'text.secondary' }}>
            {type === 'list' ? '≡' : '▱'}
          </Box>
          <Box component="span" sx={{ overflowWrap: 'anywhere' }}>
            {name}
          </Box>
        </ButtonBase>
      </Box>
      {onToggle && (
        <Box component="ul" id={id} hidden={!expanded} sx={{ pl: 4, m: 0 }}>
          {children}
        </Box>
      )}
    </Box>
  );
}
