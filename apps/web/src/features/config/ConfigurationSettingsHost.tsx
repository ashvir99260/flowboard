'use client';

import { Box } from '@flowboard/ui';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { AdministrationSettings } from '../administration/AdministrationSettings';
import { WorkspaceSettings } from '../workspaces/WorkspaceSettings';

import { FieldSettings } from './fields/FieldSettings';
import { StatusSettings } from './statuses/StatusSettings';

import type { ReactNode } from 'react';

// The verified workspace owns the editor, so local navigation never unmounts a dirty form.
export function ConfigurationSettingsHost({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const workspaceActive = /^\/w\/[^/]+\/settings\/workspace\/?$/.test(pathname);
  const administrationActive = /^\/w\/[^/]+\/settings\/administration\/?$/.test(pathname);
  const statusActive = /^\/w\/[^/]+\/settings\/statuses\/?$/.test(pathname);
  const fieldActive = /^\/w\/[^/]+\/settings\/fields\/?$/.test(pathname);

  const [visited, setVisited] = useState({
    statuses: statusActive,
    fields: fieldActive,
    workspace: workspaceActive,
    administration: administrationActive,
  });

  if (
    (statusActive && !visited.statuses) ||
    (fieldActive && !visited.fields) ||
    (workspaceActive && !visited.workspace) ||
    (administrationActive && !visited.administration)
  )
    setVisited({
      statuses: visited.statuses || statusActive,
      fields: visited.fields || fieldActive,
      workspace: visited.workspace || workspaceActive,
      administration: visited.administration || administrationActive,
    });

  const active = statusActive || fieldActive || workspaceActive || administrationActive;

  return (
    <>
      <Box hidden={active} inert={active} sx={{ display: active ? 'none' : 'block' }}>
        {children}
      </Box>
      {visited.administration && (
        <Box
          hidden={!administrationActive}
          inert={!administrationActive}
          sx={{ display: administrationActive ? 'block' : 'none' }}
        >
          <AdministrationSettings active={administrationActive} />
        </Box>
      )}
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
