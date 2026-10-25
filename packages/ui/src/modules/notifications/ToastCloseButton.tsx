'use client';
import Button from '@mui/material/Button';

import type { CloseButtonProps } from 'react-toastify';

export function ToastCloseButton({ closeToast }: CloseButtonProps) {
  return (
    <Button aria-label="Dismiss notification" sx={{ minHeight: '4.4rem' }} onClick={closeToast}>
      Dismiss
    </Button>
  );
}
