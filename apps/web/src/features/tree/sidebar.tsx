'use client';

import { EmptyState, ErrorState, TreeItem } from '@flowboard/ui';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { SessionLoading } from '../auth/session-gate';

import { useTree } from './use-tree';

import type { TreeBranch } from './assemble-tree';
import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';

function Branches({
  items,
  selectedId,
  select,
}: {
  items: readonly TreeBranch[];
  select: (id: string) => void;
  selectedId?: string;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  const render = (branch: TreeBranch) => (
    <TreeItem
      key={branch.node.id}
      name={branch.node.name}
      type={branch.node.type}
      selected={branch.node.id === selectedId}
      expanded={!collapsed.has(branch.node.id)}
      onToggle={branch.node.type === 'list' ? undefined : () => toggle(branch.node.id)}
      onSelect={() =>
        branch.node.type === 'list' ? select(branch.node.id) : toggle(branch.node.id)
      }
    >
      {branch.children.map(render)}
    </TreeItem>
  );

  return (
    <Box component="ul" sx={{ p: 0, m: 0 }}>
      {items.map(render)}
    </Box>
  );
}

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
    <Branches
      items={tree.items}
      selectedId={selectedId}
      select={(id) => {
        router.push(`/w/${scope.workspaceId}/lists/${id}`);
        onSelect();
      }}
    />
  );
}
