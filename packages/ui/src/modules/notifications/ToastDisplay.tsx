'use client';
import { styled } from '@mui/material/styles';
import { useEffect, useRef } from 'react';
import { toast, ToastContainer } from 'react-toastify';

import { ToastCloseButton } from './ToastCloseButton.js';

import type { ToastMessage } from './toastTypes.js';

const Container = styled(ToastContainer)(({ theme }) => ({
  '--toastify-color-light': (theme.vars ?? theme).palette.background.paper,
  '--toastify-text-color-light': (theme.vars ?? theme).palette.text.primary,
  '--toastify-color-success': (theme.vars ?? theme).palette.success.main,
  '--toastify-color-error': (theme.vars ?? theme).palette.error.main,
  '--toastify-color-info': (theme.vars ?? theme).palette.info.main,
  '--toastify-color-warning': (theme.vars ?? theme).palette.warning.main,
  '--toastify-toast-width': '36rem',
  '--toastify-font-family': theme.typography.fontFamily,
  width: 'min(36rem, calc(100vw - 3.2rem))',
  padding: 0,
  right: '1.6rem',
  bottom: '1.6rem',
  top: 'auto',
  left: 'auto',
  transform: 'none',
  '& .Toastify__toast': {
    width: '100%',
    minHeight: '5.6rem',
    padding: theme.spacing(1.2),
    marginBottom: theme.spacing(0.8),
    border: `1px solid ${(theme.vars ?? theme).palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    fontSize: '1.4rem',
    overflowWrap: 'anywhere',
    gap: theme.spacing(0.8),
  },
  '& .Toastify__toast-icon': { width: '2rem', marginInlineEnd: 0 },
  '@media (prefers-reduced-motion: reduce)': {
    '& *, & *::before, & *::after': { animationDuration: '0.01ms', transitionDuration: '0.01ms' },
  },
}));

export function ToastDisplay({
  message,
  onDismiss,
}: {
  message: ToastMessage | undefined;
  onDismiss: (id: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const origin = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!message) return;

    let active = true;
    const element = root.current;
    const dismiss = () => {
      const restore = element?.contains(document.activeElement);
      onDismiss(message.id);
      if (restore && origin.current?.isConnected) origin.current.focus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      event.stopPropagation();
      dismiss();
    };
    element?.addEventListener('keydown', onKeyDown);
    origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    toast(message.message, {
      toastId: message.id,
      containerId: 'flowboard',
      type: message.severity,
      ariaLabel: `Notification: ${message.message}`,
      role: 'status',
      autoClose: message.severity === 'error' || message.severity === 'warning' ? false : 6000,
      onClose: () => {
        if (active) dismiss();
      },
    });

    return () => {
      active = false;
      element?.removeEventListener('keydown', onKeyDown);
      toast.dismiss({ id: message.id, containerId: 'flowboard' });
      toast.clearWaitingQueue({ containerId: 'flowboard' });
    };
  }, [message, onDismiss]);

  return (
    <div ref={root}>
      <Container
        key={message?.id}
        containerId="flowboard"
        position="bottom-right"
        closeButton={ToastCloseButton}
        hideProgressBar
        closeOnClick={false}
        draggable={false}
        pauseOnFocusLoss
        pauseOnHover
        hotKeys={(event) => {
          if (!(event.altKey && event.code === 'KeyT')) return false;

          if (
            document.activeElement instanceof HTMLElement &&
            !root.current?.contains(document.activeElement)
          )
            origin.current = document.activeElement;

          return true;
        }}
      />
    </div>
  );
}
