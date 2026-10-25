'use client';
import IconButton from '@mui/material/IconButton';

import { WorkspaceIcon } from '../navigation/WorkspaceIcon.js';

import type { CloseButtonProps } from 'react-toastify';

export function ToastCloseButton({ closeToast }: CloseButtonProps) {
  return (
    <IconButton aria-label="Dismiss notification" onClick={closeToast}>
      <WorkspaceIcon name="close" />
    </IconButton>
  );
}
