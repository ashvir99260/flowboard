'use client';

import MuiDialog from '@mui/material/Dialog';

import { ToastRegion } from '../notifications/toastRegion.js';

import type { DialogProps } from '@mui/material/Dialog';

export function Dialog({ children, ...props }: DialogProps) {
  return (
    <MuiDialog {...props}>
      <ToastRegion />
      {children}
    </MuiDialog>
  );
}
