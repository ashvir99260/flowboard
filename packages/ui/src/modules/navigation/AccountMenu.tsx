'use client';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useId, useState } from 'react';

import { Button } from '../primitives/Button.js';

import { WorkspaceIcon } from './WorkspaceIcon.js';

import type { WorkspaceRole } from '@flowboard/contracts';

const Identity = styled(Button)(({ theme }) => ({
  gap: theme.spacing(0.8),
  color: (theme.vars ?? theme).palette.text.primary,
  padding: theme.spacing(0.4, 0.6),
  textTransform: 'none',
  textAlign: 'left',
}));
const Avatar = styled('span')(({ theme }) => ({
  alignItems: 'center',
  backgroundColor: (theme.vars ?? theme).palette.primary.main,
  borderRadius: '50%',
  color: (theme.vars ?? theme).palette.primary.contrastText,
  display: 'inline-flex',
  flexShrink: 0,
  fontSize: '1.2rem',
  fontWeight: 650,
  height: '3.2rem',
  justifyContent: 'center',
  width: '3.2rem',
}));

export function AccountMenu({
  name,
  role,
  onSignOut,
}: Readonly<{
  name: string;
  onSignOut: () => void;
  role: WorkspaceRole;
}>) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const menuId = useId();

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <>
      <Identity
        aria-label={`Account menu for ${initials} ${name} ${role}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        aria-controls={anchor ? menuId : undefined}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <Avatar aria-hidden="true">{initials}</Avatar>{' '}
        <Stack sx={{ display: { xs: 'none', lg: 'flex' }, minWidth: 0 }}>
          <Typography
            component="span"
            noWrap
            sx={{ fontSize: '1.2rem', fontWeight: 600, lineHeight: 1.4, maxWidth: '14rem' }}
          >
            {name}
          </Typography>{' '}
          <Typography
            component="span"
            color="text.secondary"
            sx={{ fontSize: '1.1rem', textTransform: 'capitalize', lineHeight: 1.4 }}
          >
            {role}
          </Typography>
        </Stack>
        <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
          <WorkspaceIcon name="chevronDown" />
        </Box>
      </Identity>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box
          sx={{
            px: 1.6,
            py: 1.2,
            minWidth: '20rem',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{name}</Typography>
          <Typography color="text.secondary" variant="caption" sx={{ textTransform: 'capitalize' }}>
            {role}
          </Typography>
        </Box>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onSignOut();
          }}
          sx={{ gap: 1 }}
        >
          <WorkspaceIcon name="logOut" />
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}
