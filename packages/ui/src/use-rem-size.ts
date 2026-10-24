'use client';

import { useEffect, useRef, useState } from 'react';

/** Converts document-rem dimensions for widgets whose geometry API requires pixels. */
export function useRemSize() {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(10);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const measured = element.getBoundingClientRect().width;
      if (measured > 0) setSize(measured);
    };
    update();
    const observer =
      typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(update) : null;
    observer?.observe(element);

    return () => observer?.disconnect();
  }, []);

  return { ref, size };
}
