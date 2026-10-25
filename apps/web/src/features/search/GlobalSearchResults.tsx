'use client';

import {
  Box,
  Button,
  EmptyState,
  ErrorState,
  Stack,
  Typography,
  WorkspaceIcon,
} from '@flowboard/ui';

import { apiError } from '../../lib/apiError';

import { useSearchWorkspaceInfiniteQuery } from './useSearchWorkspaceInfiniteQuery';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { SearchHit } from '@flowboard/contracts';

export function GlobalSearchResults({
  q,
  runtime,
  scope,
  onSelect,
}: {
  onSelect: (hit: SearchHit) => void;
  q: string;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const query = useSearchWorkspaceInfiniteQuery({ q, runtime, scope });

  if (query.isPending) return <Typography role="status">Searching your workspace…</Typography>;

  if (query.isError)
    return (
      <ErrorState
        title="Search unavailable"
        description={apiError(query.error).message}
        action={
          <Button
            onClick={() => {
              void query.refetch();
            }}
          >
            Retry search
          </Button>
        }
      />
    );

  const items = query.data.pages.flatMap((page) => page.items);

  if (!items.length)
    return (
      <EmptyState
        description="Try a different word or phrase. Only tasks and lists you can access are searched."
        title="No results"
      />
    );

  return (
    <Stack spacing={0.4} aria-label="Search results">
      <Typography color="text.secondary" role="status" variant="caption">
        {items.length} {items.length === 1 ? 'result' : 'results'}
        {query.hasNextPage ? ' loaded' : ''}
      </Typography>
      {items.map((hit) => (
        <Button
          key={`${hit.type}:${hit.id}`}
          onClick={() => onSelect(hit)}
          aria-label={`Open ${hit.type}: ${hit.title}`}
          sx={{
            justifyContent: 'flex-start',
            textAlign: 'left',
            gap: 1.2,
            p: 1.2,
            color: 'text.primary',
            textTransform: 'none',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <WorkspaceIcon name={hit.type === 'task' ? 'check' : 'list'} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{hit.title}</Typography>
            <Typography color="text.secondary" variant="caption" sx={{ overflowWrap: 'anywhere' }}>
              {hit.type === 'task' ? 'Task' : 'List'} · {hit.path.join(' / ')}
            </Typography>
          </Box>
        </Button>
      ))}
      {query.hasNextPage && (
        <Button
          disabled={query.isFetchingNextPage}
          onClick={() => {
            void query.fetchNextPage();
          }}
        >
          {query.isFetchingNextPage ? 'Loading results…' : 'Load more results'}
        </Button>
      )}
    </Stack>
  );
}
