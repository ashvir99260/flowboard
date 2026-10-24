'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useId, useRef } from 'react';

export function ConfirmDialog({
  busy = false,
  confirmLabel = 'Confirm',
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: Readonly<{
  busy?: boolean;
  confirmLabel?: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}>) {
  const id = useId();
  const cancel = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onClose={() => {
        if (!busy) onCancel();
      }}
      fullWidth
      maxWidth="xs"
      slotProps={{ transition: { onEntered: () => cancel.current?.focus() } }}
    >
      <DialogTitle id={`${id}-title`}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id={`${id}-description`}>{description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button ref={cancel} disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={busy} onClick={onConfirm} variant="contained">
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
