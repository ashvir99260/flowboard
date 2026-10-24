'use client';

import { Box } from '@flowboard/ui';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { FieldSettings } from './fields/field-settings';
import { StatusSettings } from './statuses/status-settings';

import type { ReactNode } from 'react';

// The verified workspace owns the editor, so local navigation never unmounts a dirty form.
export function ConfigurationSettingsHost({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const statusActive = /^\/w\/[^/]+\/settings\/statuses\/?$/.test(pathname);
  const fieldActive = /^\/w\/[^/]+\/settings\/fields\/?$/.test(pathname);

  const [visited, setVisited] = useState({ statuses: statusActive, fields: fieldActive });

  if ((statusActive && !visited.statuses) || (fieldActive && !visited.fields))
    setVisited({
      statuses: visited.statuses || statusActive,
      fields: visited.fields || fieldActive,
    });

  const active = statusActive || fieldActive;

  return (
    <>
      <Box hidden={active} inert={active} sx={{ display: active ? 'none' : 'block' }}>
        {children}
      </Box>
      {visited.statuses && (
        <Box
          hidden={!statusActive}
          inert={!statusActive}
          sx={{ display: statusActive ? 'block' : 'none' }}
        >
          <StatusSettings active={statusActive} />
        </Box>
      )}
      {visited.fields && (
        <Box
          hidden={!fieldActive}
          inert={!fieldActive}
          sx={{ display: fieldActive ? 'block' : 'none' }}
        >
          <FieldSettings active={fieldActive} />
        </Box>
      )}
    </>
  );
}
