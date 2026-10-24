'use client';

import { EmptyState, ErrorState } from '@flowboard/ui';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { TaskTable } from './task-table';

import type { useListQuery } from './use-list-query';

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

export function ListResult({ view }: { view: ListView }) {
  const error = failure(view);
  if (error)
    return (
      <ErrorState
        title={error.title}
        description={error.message}
        action={<Button onClick={view.retry}>Retry tasks</Button>}
      />
    );

  const { result } = view;
  if (result.state !== 'ready')
    return (
      <Stack direction="row" role="status" spacing={2}>
        <CircularProgress aria-hidden="true" size={20} />
        <Typography>Loading tasks…</Typography>
      </Stack>
    );

  if (!result.items.length)
    return (
      <EmptyState
        description="Try clearing the filter, or choose another list."
        title="No matching tasks"
      />
    );

  return (
    <>
      <Typography color="text.secondary" variant="body2">
        {result.items.length} loaded tasks
      </Typography>
      <TaskTable items={result.items} fields={result.fields} statuses={result.statuses} />
      {result.nextCursor && (
        <Button disabled={view.loadingMore || view.atLimit} onClick={view.loadMore}>
          {view.atLimit ? 'Page limit reached' : view.loadingMore ? 'Loading…' : 'Load more tasks'}
        </Button>
      )}
    </>
  );
}
