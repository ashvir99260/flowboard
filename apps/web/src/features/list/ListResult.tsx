'use client';

import { Button, ErrorState, TableSkeleton, Typography } from '@flowboard/ui';
import { useState } from 'react';

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
  const [hasLoaded, setHasLoaded] = useState(false);

  const error = failure(view);
  const { result } = view;
  if (error && hasLoaded) setHasLoaded(false);
  else if (!error && result.state === 'ready' && !hasLoaded) setHasLoaded(true);

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

  const ready = result.state === 'ready';
  if (!ready && !hasLoaded) return <TableSkeleton />;

  return (
    <>
      <Typography color="text.secondary" variant="body2">
        {ready ? `${result.items.length} loaded tasks` : 'Loading tasks…'}
      </Typography>
      <TaskTable
        query={query}
        onChange={onChange}
        pending={pending}
        loading={!ready}
        items={ready ? result.items : []}
        fields={view.fields}
        statuses={view.statuses}
        selection={selection && { ...selection, disabled: selection.disabled || !ready }}
      />
      {ready && result.nextCursor && (
        <Button disabled={view.loadingMore || view.atLimit} onClick={view.loadMore}>
          {view.atLimit ? 'Page limit reached' : view.loadingMore ? 'Loading…' : 'Load more tasks'}
        </Button>
      )}
    </>
  );
}
