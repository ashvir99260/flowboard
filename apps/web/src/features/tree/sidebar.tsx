'use client';

import { listVisibleTreeInfiniteOptions } from '@flowboard/api-client/tanstack-query';
import { TreePageSchema } from '@flowboard/contracts';
import { EmptyState, ErrorState, TreeItem } from '@flowboard/ui';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiError } from '../../lib/api-error';
import { withQueryScope } from '../../lib/query-scope';
import { SessionLoading } from '../auth/session-gate';

import { assembleTree } from './assemble-tree';

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
  const [attempt, setAttempt] = useState(0);
  const query = useInfiniteQuery({
    ...withQueryScope(
      listVisibleTreeInfiniteOptions({ client: runtime.client, query: { limit: '50' } }),
      scope,
      [`tree-attempt:${attempt}`],
    ),
    initialPageParam: { query: {} },
    getNextPageParam: (page) => {
      const parsed = TreePageSchema.safeParse(page);

      return parsed.success ? (parsed.data.pageInfo.nextCursor ?? undefined) : undefined;
    },
  });
  const parsed = TreePageSchema.array().safeParse(query.data?.pages ?? []);
  const pages = parsed.success ? parsed.data : [];
  const cursors = pages.flatMap((page) => page.pageInfo.nextCursor ?? []);
  const repeated = new Set(cursors).size !== cursors.length;
  const exceeded = query.hasNextPage && (query.data?.pages.length ?? 0) >= 100;
  const complete =
    !query.hasNextPage && query.data ? assembleTree(pages, scope.workspaceId!) : null;
  const stale =
    (query.isError && apiError(query.error).code === 'CURSOR_STALE') ||
    Boolean(complete && !complete.ok) ||
    !parsed.success;
  const { hasNextPage, isFetching, isError, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetching && !isError && !repeated && !exceeded) void fetchNextPage();
  }, [exceeded, hasNextPage, isFetching, isError, fetchNextPage, repeated]);

  if (stale && attempt === 0) setAttempt(1);

  if (
    (stale && attempt === 0) ||
    query.isPending ||
    (query.hasNextPage && !query.isError && !repeated && !exceeded)
  )
    return <SessionLoading />;

  if (query.isError || repeated || exceeded || !complete?.ok)
    return (
      <ErrorState
        title="Unable to load navigation"
        description={
          query.isError
            ? apiError(query.error).message
            : 'Navigation changed or returned an incomplete response. Try again.'
        }
        action={
          <Button onClick={() => setAttempt((current) => current + 1)}>Retry navigation</Button>
        }
      />
    );

  if (!complete.items.length)
    return (
      <EmptyState
        description="Your workspace has no containers you can access yet."
        title="No visible lists"
      />
    );

  return (
    <Branches
      items={complete.items}
      selectedId={selectedId}
      select={(id) => {
        router.push(`/w/${scope.workspaceId}/lists/${id}`);
        onSelect();
      }}
    />
  );
}
