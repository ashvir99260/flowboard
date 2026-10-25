'use client';

import { Box } from '@flowboard/ui';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { WorkspaceSettings } from '../workspaces/workspace-settings';

import { FieldSettings } from './fields/field-settings';
import { StatusSettings } from './statuses/status-settings';

import type { ReactNode } from 'react';

// The verified workspace owns the editor, so local navigation never unmounts a dirty form.
export function ConfigurationSettingsHost({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const workspaceActive = /^\/w\/[^/]+\/settings\/workspace\/?$/.test(pathname);
  const statusActive = /^\/w\/[^/]+\/settings\/statuses\/?$/.test(pathname);
  const fieldActive = /^\/w\/[^/]+\/settings\/fields\/?$/.test(pathname);

  const [visited, setVisited] = useState({
    statuses: statusActive,
    fields: fieldActive,
    workspace: workspaceActive,
  });

  if (
    (statusActive && !visited.statuses) ||
    (fieldActive && !visited.fields) ||
    (workspaceActive && !visited.workspace)
  )
    setVisited({
      statuses: visited.statuses || statusActive,
      fields: visited.fields || fieldActive,
      workspace: visited.workspace || workspaceActive,
    });

  const active = statusActive || fieldActive || workspaceActive;

  return (
    <>
      <Box hidden={active} inert={active} sx={{ display: active ? 'none' : 'block' }}>
        {children}
      </Box>
      {visited.workspace && (
        <Box
          hidden={!workspaceActive}
          inert={!workspaceActive}
          sx={{ display: workspaceActive ? 'block' : 'none' }}
        >
          <WorkspaceSettings />
        </Box>
      )}
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
