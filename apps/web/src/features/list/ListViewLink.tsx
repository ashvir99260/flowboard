'use client';

import { Button } from '@flowboard/ui';
import NextLink from 'next/link';

import type { ReactNode } from 'react';

export function ListViewLink({
  active,
  href,
  children,
}: {
  active: boolean;
  children: ReactNode;
  href: string;
}) {
  return (
    <Button
      component={NextLink}
      href={href}
      aria-current={active ? 'page' : undefined}
      variant={active ? 'contained' : 'outlined'}
    >
      {children}
    </Button>
  );
}
