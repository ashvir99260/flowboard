'use client';

import { Box, TreeItem } from '@flowboard/ui';
import { useState } from 'react';
import type { TreeBranch } from './assembleTree';

export function SidebarBranches({
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
