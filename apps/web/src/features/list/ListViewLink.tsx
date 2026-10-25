'use client';

import { IconButton, Tooltip, WorkspaceIcon } from '@flowboard/ui';
import NextLink from 'next/link';

export function ListViewLink({
  active,
  href,
  view,
}: {
  active: boolean;
  href: string;
  view: 'board' | 'list';
}) {
  const label = view === 'board' ? 'Board view' : 'List view';

  return (
    <Tooltip title={label} describeChild>
      <IconButton
        component={NextLink}
        href={href}
        prefetch={false}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        color={active ? 'primary' : 'default'}
        sx={{ bgcolor: active ? 'action.selected' : undefined, borderRadius: 1 }}
      >
        <WorkspaceIcon name={view} />
      </IconButton>
    </Tooltip>
  );
}
