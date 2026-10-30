'use client';

import { Box, TreeItem } from '@flowboard/ui';
import { useState } from 'react';

import type { Container } from './administrationData';

export function ContainerHierarchy({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: readonly Container[];
  onSelect: (nodeId: string) => void;
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
  const children = (parentId: string | null) =>
    nodes
      .filter((node) => node.parentId === parentId)
      .toSorted((left, right) => left.position - right.position || left.id.localeCompare(right.id));
  const render = (node: Container) => (
    <TreeItem
      key={node.id}
      name={node.name}
      type={node.type}
      selected={node.id === selectedId}
      expanded={!collapsed.has(node.id)}
      onSelect={() => onSelect(node.id)}
      onToggle={node.type === 'list' ? undefined : () => toggle(node.id)}
    >
      {children(node.id).map(render)}
    </TreeItem>
  );

  return (
    <Box component="ul" sx={{ p: 0, m: 0 }}>
      {children(null).map(render)}
    </Box>
  );
}
