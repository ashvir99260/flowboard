'use client';

import IconButton from '@mui/material/IconButton';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useEffect, useId, useRef } from 'react';

import { Toolbar } from '../layout/Toolbar.js';
import { WorkspaceIcon } from '../navigation/WorkspaceIcon.js';
import { ToastRegion } from '../notifications/ToastRegion.js';

import type { ReactNode } from 'react';

const Panel = styled('section', { name: 'FlowboardSettingsDetailPanel' })(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  minWidth: 0,
  padding: theme.spacing(2),
  border: `1px solid ${(theme.vars ?? theme).palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: (theme.vars ?? theme).palette.background.paper,
  overflowWrap: 'anywhere',
  '& .Toastify__toast-container': {
    position: 'static',
    width: '100%',
    right: 'auto',
    bottom: 'auto',
  },
}));

export function SettingsDetailPanel({
  children,
  title,
  closeLabel,
  closeDisabled = false,
  active = true,
  onClose,
}: {
  active?: boolean;
  children: ReactNode;
  closeDisabled?: boolean;
  closeLabel: string;
  onClose: () => void;
  title: string;
}) {
  const id = useId();
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!panel.current?.contains(document.activeElement)) close.current?.focus();
  }, []);

  return (
    <Panel
      data-settings-panel
      ref={panel}
      aria-labelledby={id}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented && !closeDisabled) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <Toolbar.Root>
        <Typography id={id} component="h2" variant="h3">
          {title}
        </Typography>
        <IconButton ref={close} aria-label={closeLabel} disabled={closeDisabled} onClick={onClose}>
          <WorkspaceIcon name="close" />
        </IconButton>
      </Toolbar.Root>
      {children}
      {active && <ToastRegion />}
    </Panel>
  );
}
