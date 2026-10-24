'use client';

import { styled } from '@mui/material/styles';
import { useId, useRef } from 'react';

import { Toolbar } from '../composition.js';
import { Button, Drawer, Stack, Typography } from '../primitives.js';

import type { ReactNode } from 'react';

const Panel = styled(Drawer, { name: 'FlowboardDrawer', slot: 'Root' })(({ theme }) => ({
  '& .MuiDrawer-paper': {
    width: '100%',
    maxWidth: '100%',
    padding: theme.spacing(3),
    [theme.breakpoints.up('sm')]: { width: 560 },
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
      <Stack spacing={3}>
        <Toolbar.Root>
          <Typography component="h2" variant="h2" id={id}>
            {title}
          </Typography>
          <Button ref={close} disabled={closeDisabled} onClick={onClose}>
            {closeLabel}
          </Button>
        </Toolbar.Root>
        {children}
      </Stack>
    </Panel>
  );
}
