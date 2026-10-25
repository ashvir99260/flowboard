'use client';

import { Button, EmptyState, ErrorState } from '@flowboard/ui';
import { useRouter } from 'next/navigation';

import { SessionLoading } from '../auth/SessionLoading';

import { SidebarBranches } from './SidebarBranches';
import { useTree } from './useTree';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';

export function Sidebar({
  runtime,
  scope,
  selectedId,
  onSelect,
}: {
  onSelect: () => void;
  runtime: ClientRuntime;
  scope: QueryScope;
  selectedId?: string;
}) {
  const router = useRouter();
  const tree = useTree(runtime, scope);

  if (tree.state === 'loading') return <SessionLoading />;

  if (tree.state === 'error')
    return (
      <ErrorState
        title="Unable to load navigation"
        description={tree.message}
        action={<Button onClick={tree.retry}>Retry navigation</Button>}
      />
    );

  if (!tree.items.length)
    return (
      <EmptyState
        description="Your workspace has no containers you can access yet."
        title="No visible lists"
      />
    );

  return (
    <SidebarBranches
      items={tree.items}
      selectedId={selectedId}
      select={(id) => {
        router.push(`/w/${scope.workspaceId}/lists/${id}`);
        onSelect();
      }}
    />
  );
}
