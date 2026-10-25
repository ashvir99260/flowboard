'use client';

import { styled } from '@mui/material/styles';

import { Button } from '../primitives/Button.js';

import { WorkspaceIcon } from './WorkspaceIcon.js';

const SearchButton = styled(Button)(({ theme }) => ({
  backgroundColor: (theme.vars ?? theme).palette.action.hover,
  border: `1px solid ${(theme.vars ?? theme).palette.divider}`,
  color: (theme.vars ?? theme).palette.text.secondary,
  flex: 1,
  fontWeight: 400,
  gap: theme.spacing(1),
  justifyContent: 'flex-start',
  maxWidth: '40rem',
  marginInline: 'auto',
  minWidth: 0,
  textTransform: 'none',
  '& span': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  [theme.breakpoints.down('sm')]: {
    justifyContent: 'center',
    width: '3.6rem',
    flex: '0 0 auto',
    '& span': { display: 'none' },
  },
}));

export function HeaderSearchButton({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <SearchButton aria-label="Search tasks and lists" onClick={onClick}>
      <WorkspaceIcon name="search" />
      <span>Search tasks and lists…</span>
    </SearchButton>
  );
}
