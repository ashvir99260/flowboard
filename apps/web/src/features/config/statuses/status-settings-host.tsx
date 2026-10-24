'use client';

import Box from '@mui/material/Box';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { StatusSettings } from './status-settings';

import type { ReactNode } from 'react';

// The verified workspace owns the editor, so local navigation never unmounts a dirty form.
export function StatusSettingsHost({ children }: { children: ReactNode }) {
  const active = /^\/w\/[^/]+\/settings\/statuses\/?$/.test(usePathname());
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);

  return (
    <>
      <Box hidden={active} inert={active} sx={{ display: active ? 'none' : 'block' }}>
        {children}
      </Box>
      {visited && (
        <Box hidden={!active} inert={!active} sx={{ display: active ? 'block' : 'none' }}>
          <StatusSettings active={active} />
        </Box>
      )}
    </>
  );
}
