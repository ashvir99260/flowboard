'use client';

import { Box, Button, Stack, Typography, WorkspaceIcon } from '@flowboard/ui';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';

import { Sidebar } from '../tree/Sidebar';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';

export function WorkspaceNavigation({
  runtime,
  scope,
  selectedId,
  workspace,
  onSelect,
}: {
  onSelect: () => void;
  runtime: ClientRuntime;
  scope: QueryScope;
  selectedId?: string;
  workspace: { name: string; role: 'admin' | 'member' };
}) {
  const pathname = usePathname();

  const home = `/w/${scope.workspaceId}`;
  const links = [
    { label: 'Containers and access', path: 'administration', icon: 'people' },
    { label: 'Workspace settings', path: 'workspace', icon: 'settings' },
    { label: 'Status settings', path: 'statuses', icon: 'board' },
    { label: 'Field settings', path: 'fields', icon: 'list' },
  ] as const;

  return (
    <>
      <Button
        component={NextLink}
        href="/workspaces"
        onClick={onSelect}
        sx={{ justifyContent: 'space-between', gap: 1, py: 1.2, mb: 1.2, textTransform: 'none' }}
      >
        <Stack direction="row" spacing={1} sx={{ minWidth: 0, alignItems: 'center' }}>
          <Box
            sx={{
              width: '3.2rem',
              height: '3.2rem',
              borderRadius: 1,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              fontWeight: 700,
            }}
            aria-hidden="true"
          >
            {workspace.name.slice(0, 1).toUpperCase()}
          </Box>
          <Stack sx={{ minWidth: 0, alignItems: 'flex-start' }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 650,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '15.2rem',
              }}
            >
              {workspace.name}
            </Typography>
            <Typography color="text.secondary" variant="caption">
              Switch workspace
            </Typography>
          </Stack>
        </Stack>
        <WorkspaceIcon name="chevronDown" />
      </Button>
      <Button
        component={NextLink}
        href={home}
        onClick={onSelect}
        aria-current={pathname === home ? 'page' : undefined}
        startIcon={<WorkspaceIcon name="board" />}
        sx={{
          justifyContent: 'flex-start',
          bgcolor: pathname === home ? 'action.selected' : 'transparent',
        }}
      >
        Workspace board
      </Button>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          px: 1,
          mt: 2.4,
          mb: 0.8,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Spaces & lists
      </Typography>
      <Sidebar runtime={runtime} scope={scope} selectedId={selectedId} onSelect={onSelect} />
      {workspace.role === 'admin' && (
        <>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              px: 1,
              mt: 2.4,
              mb: 0.8,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Manage
          </Typography>
          {links.map(({ label, path, icon }) => (
            <Button
              key={path}
              component={NextLink}
              href={`${home}/settings/${path}`}
              onClick={onSelect}
              startIcon={<WorkspaceIcon name={icon} />}
              aria-current={pathname === `${home}/settings/${path}` ? 'page' : undefined}
              sx={{
                justifyContent: 'flex-start',
                color: 'text.secondary',
                fontSize: '1.2rem',
                bgcolor:
                  pathname === `${home}/settings/${path}` ? 'action.selected' : 'transparent',
              }}
            >
              {label}
            </Button>
          ))}
        </>
      )}
    </>
  );
}
