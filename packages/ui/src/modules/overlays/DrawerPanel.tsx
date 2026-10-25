'use client';

import { default as Drawer } from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import { default as Stack } from '@mui/material/Stack';
import { styled } from '@mui/material/styles';
import { default as Typography } from '@mui/material/Typography';
import { useId, useRef } from 'react';


import { Toolbar } from '../layout/Toolbar.js';
import { WorkspaceIcon } from '../navigation/WorkspaceIcon.js';
import { ToastRegion } from '../notifications/ToastRegion.js';

import type { ReactNode } from 'react';

const Panel = styled(Drawer, { name: 'FlowboardDrawer', slot: 'Root' })(({ theme }) => ({
  '& .MuiDrawer-paper': {
    width: '100%',
    maxWidth: '100%',
    padding: theme.spacing(1.2),
    [theme.breakpoints.up('sm')]: { width: '56rem' },
  },
}));

export function DrawerPanel({
  children,
  open,
  title,
  closeLabel = 'Close',
  closeDisabled = false,
  onClose,
}: Readonly<{
  children: ReactNode;
  closeDisabled?: boolean;
  closeLabel?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}>) {
  const id = useId();
  const close = useRef<HTMLButtonElement>(null);

  return (
    <Panel
      open={open}
      anchor="right"
      onClose={() => {
        if (!closeDisabled) onClose();
      }}
      slotProps={{
        paper: { role: 'dialog', 'aria-labelledby': id },
        transition: { onEntered: () => close.current?.focus() },
      }}
    >
      <ToastRegion />
      <Stack spacing={1.2}>
        <Toolbar.Root>
          <Typography component="h2" variant="h2" id={id}>
            {title}
          </Typography>
          <IconButton
            ref={close}
            disabled={closeDisabled}
            onClick={onClose}
            aria-label={closeLabel}
          >
            <WorkspaceIcon name="close" />
          </IconButton>
        </Toolbar.Root>
        {children}
      </Stack>
    </Panel>
  );
}
