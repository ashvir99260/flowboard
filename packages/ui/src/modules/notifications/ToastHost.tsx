'use client';
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

import { RegionContext } from './toastContext.js';
import { ToastDisplay } from './ToastDisplay.js';

import type { ToastMessage } from './toastTypes.js';
import type { ReactNode } from 'react';

type ToastHostProps = {
  children: ReactNode;
  message: ToastMessage | undefined;
  onDismiss: (id: number) => void;
};

export function ToastHost({ children, message, onDismiss }: ToastHostProps) {
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
