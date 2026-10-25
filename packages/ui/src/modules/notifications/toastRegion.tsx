'use client';
import { useContext, useEffect, useRef } from 'react';

import { RegionContext } from './toastContext.js';

/** Register inside modal content so notifications share its accessible/focus boundary. */
export function ToastRegion() {
  const register = useContext(RegionContext);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (register && ref.current?.parentElement) return register(ref.current.parentElement);
  }, [register]);

  return <span ref={ref} hidden />;
}
