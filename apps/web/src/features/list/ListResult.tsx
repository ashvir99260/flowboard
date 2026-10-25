'use client';

import { Button, CircularProgress, ErrorState, Stack, Typography } from '@flowboard/ui';

import { TaskTable } from './TaskTable';

import type { TaskTableQuery } from './listLocation';
import type { useListQuery } from './useListQuery';

type ListView = ReturnType<typeof useListQuery>;

function failure(view: ListView) {
  if (view.filterError) return { title: 'Invalid filter', message: view.filterError };

  if (view.error)
    return {
      title: view.error.code === 'FORBIDDEN' ? 'Access denied' : 'Unable to load tasks',
      message: view.error.message,
    };

  if (view.result.state === 'invalid')
    return {
      title: 'Unable to load tasks',
      message: 'The list response could not be displayed. Try again.',
    };

  if (view.result.state === 'stale')
    return { title: 'Unable to load tasks', message: 'The list changed while loading. Try again.' };

  return null;
}

export function ListResult({
  view,
  selection,
  query,
  onChange,
  pending,
}: {
  onChange: (query: TaskTableQuery) => void;
  pending: boolean;
  query: TaskTableQuery;
  selection?: { disabled?: boolean; ids: readonly string[]; onChange: (ids: string[]) => void };
  view: ListView;
}) {
  const error = failure(view);
  if (error)
    return (
      <ErrorState
        title={error.title}
        description={error.message}
        action={
          view.filterError ? (
            <Button
              onClick={() =>
                onChange({
                  sort: query.sort,
                  direction: query.direction,
                  ...(query.q ? { q: query.q } : {}),
                })
              }
            >
              Clear filter
            </Button>
          ) : (
            <Button onClick={view.retry}>Retry tasks</Button>
          )
        }
      />
    );

  const { result } = view;
  if (result.state !== 'ready' && !view.configured)
    return (
      <Stack direction="row" role="status" spacing={0.8}>
        <CircularProgress aria-hidden="true" size={'2rem'} />
        <Typography>Loading tasks…</Typography>
      </Stack>
    );

  return (
    <>
      <Typography color="text.secondary" variant="body2">
        {result.state === 'ready' ? `${result.items.length} loaded tasks` : 'Loading tasks…'}
      </Typography>
      <TaskTable
        query={query}
        onChange={onChange}
        pending={pending}
        loading={result.state !== 'ready'}
        items={result.state === 'ready' ? result.items : []}
        fields={result.state === 'ready' ? result.fields : view.fields}
        statuses={result.state === 'ready' ? result.statuses : view.statuses}
        selection={
          selection
            ? { ...selection, disabled: selection.disabled || result.state !== 'ready' }
            : undefined
        }
      />
      {result.state === 'ready' && result.nextCursor && (
        <Button disabled={view.loadingMore || view.atLimit} onClick={view.loadMore}>
          {view.atLimit ? 'Page limit reached' : view.loadingMore ? 'Loading…' : 'Load more tasks'}
        </Button>
      )}
    </>
  );
}
