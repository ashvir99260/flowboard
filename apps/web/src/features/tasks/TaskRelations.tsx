'use client';

import { Button, ErrorState, Stack, Typography } from '@flowboard/ui';

import { useListRelatedTasksInfiniteQuery } from './useListRelatedTasksInfiniteQuery';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { Task } from '@flowboard/contracts';

export function TaskRelations({
  task,
  busy,
  listId,
  runtime,
  scope,
  open,
  create,
}: {
  busy: boolean;
  create: (parentTaskId: string) => void;
  listId: string;
  open: (taskId: string) => void;
  runtime: ClientRuntime;
  scope: QueryScope;
  task: Task;
}) {
  const { result, error, query, refresh } = useListRelatedTasksInfiniteQuery({
    listId,
    runtime,
    scope,
    parentTaskId: task.id,
    enabled: task.parentTaskId === null,
  });

  if (task.parentTaskId)
    return (
      <Button disabled={busy} onClick={() => open(task.parentTaskId!)}>
        Open parent task
      </Button>
    );

  return (
    <Stack component="section" aria-label="Subtasks" spacing={0.8}>
      <Typography component="h3" variant="h3">
        Subtasks
      </Typography>
      <Button disabled={busy} onClick={() => create(task.id)}>
        Add subtask
      </Button>
      {error || result.state === 'invalid' || result.state === 'stale' ? (
        <ErrorState
          title="Subtasks unavailable"
          description={error?.message ?? 'The related tasks could not be verified.'}
          action={
            <Button disabled={busy || query.isFetching} onClick={refresh}>
              Retry subtasks
            </Button>
          }
        />
      ) : result.state === 'pending' ? (
        <Typography aria-label="Loading subtasks" role="status">
          Loading subtasks…
        </Typography>
      ) : (
        <>
          {result.items.length === 0 && result.nextCursor === null && (
            <Typography color="text.secondary">No subtasks yet.</Typography>
          )}
          {result.items.map((child) => (
            <Button key={child.id} disabled={busy} onClick={() => open(child.id)}>
              {child.title}
            </Button>
          ))}
          {result.nextCursor && (
            <Button
              disabled={busy || query.isFetching}
              onClick={() => {
                void query.fetchNextPage({ cancelRefetch: false });
              }}
            >
              Load more subtasks
            </Button>
          )}
        </>
      )}
    </Stack>
  );
}
