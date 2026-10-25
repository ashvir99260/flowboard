'use client';

import MuiDialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import { styled } from '@mui/material/styles';

import { WorkspaceIcon } from '../navigation/WorkspaceIcon.js';
import { ToastRegion } from '../notifications/ToastRegion.js';

import type { DialogProps } from '@mui/material/Dialog';

const Overlay = styled(MuiDialog)(({ theme }) => ({
  '& .MuiDialogTitle-root': { paddingRight: theme.spacing(5.6) },
}));

const Close = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  right: theme.spacing(0.8),
  top: theme.spacing(0.8),
  zIndex: 1,
}));

type FlowboardDialogProps = DialogProps & { closeDisabled?: boolean };

export function Dialog({
  children,
  closeDisabled = false,
  onClose,
  ...props
}: FlowboardDialogProps) {
  return (
    <Overlay {...props} onClose={onClose}>
      {onClose && (
        <Close
          aria-label="Close dialog"
          disabled={closeDisabled}
          onClick={(event) => onClose(event, 'escapeKeyDown')}
        >
          <WorkspaceIcon name="close" />
        </Close>
      )}
      <ToastRegion />
      {children}
    </Overlay>
  );
}
