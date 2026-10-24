'use client';

import Button from '@mui/material/Button';
import { styled } from '@mui/material/styles';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast, ToastContainer } from 'react-toastify';

import type { ReactNode } from 'react';
import type { CloseButtonProps } from 'react-toastify';

export type ToastSeverity = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  message: string;
  severity: ToastSeverity;
}

const RegionContext = createContext<((element: HTMLElement) => () => void) | null>(null);
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

function CloseButton({ closeToast }: CloseButtonProps) {
  return (
    <Button aria-label="Dismiss notification" sx={{ minHeight: '4.4rem' }} onClick={closeToast}>
      Dismiss
    </Button>
  );
}

function ToastDisplay({
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
        containerId="flowboard"
        position="bottom-right"
        limit={1}
        closeButton={CloseButton}
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

/** Register inside modal content so notifications share its accessible/focus boundary. */
export function ToastRegion() {
  const register = useContext(RegionContext);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (register && ref.current?.parentElement) return register(ref.current.parentElement);
  }, [register]);

  return <span ref={ref} hidden />;
}

export function ToastHost({
  children,
  message,
  onDismiss,
}: {
  children: ReactNode;
  message: ToastMessage | undefined;
  onDismiss: (id: number) => void;
}) {
  const [regions, setRegions] = useState<HTMLElement[]>([]);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const register = useCallback((element: HTMLElement) => {
    setRegions((current) => [...current, element]);

    return () => {
      setRegions((current) => current.filter((item) => item !== element));
    };
  }, []);

  return (
    <RegionContext.Provider value={register}>
      {children}
      <div ref={setRoot} />
      {(regions.at(-1) ?? root) &&
        createPortal(
          <ToastDisplay message={message} onDismiss={onDismiss} />,
          (regions.at(-1) ?? root)!,
        )}
    </RegionContext.Provider>
  );
}
