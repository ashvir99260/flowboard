'use client';

import { FormFields } from '@flowboard/forms';
import { Button, Stack, Typography } from '@flowboard/ui';
import { useWatch } from 'react-hook-form';

import { useListRelatedTasksInfiniteQuery } from './useListRelatedTasksInfiniteQuery';

import type { Control } from 'react-hook-form';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { TaskDraft } from './taskFormData';

export function TaskParentField({
  control,
  busy,
  taskId,
  listId,
  runtime,
  scope,
}: {
  busy: boolean;
  control: Control<TaskDraft>;
  listId: string;
  runtime: ClientRuntime;
  scope: QueryScope;
  taskId?: string;
}) {
  const selected = useWatch({ control, name: 'parentTaskId' });
  const { result, error, query, refresh } = useListRelatedTasksInfiniteQuery({
    listId,
    runtime,
    scope,
  });

  const items =
    result.state === 'ready'
      ? result.items.filter((task) => task.parentTaskId === null && task.id !== taskId)
      : [];
  const invalid = error || result.state === 'invalid' || result.state === 'stale';

  return (
    <Stack spacing={0.8}>
      <FormFields
        control={control}
        disabled={busy}
        fields={[
          {
            kind: 'select',
            name: 'parentTaskId',
            label: 'Parent task',
            hint: 'Choose a top-level task in this list, or select No parent to detach.',
            options: [
              { value: null, label: 'No parent (top-level task)' },
              ...(selected && !items.some((task) => task.id === selected)
                ? [{ value: selected, label: 'Selected parent (outside loaded choices)' }]
                : []),
              ...items.map((task) => ({ value: task.id, label: task.title })),
            ],
          },
        ]}
      />
      {invalid ? (
        <>
          <Typography aria-label="Parent choices" role="status">
            {error?.message ?? 'Parent choices could not be verified. Your selection is kept.'}
          </Typography>
          <Button disabled={busy || query.isFetching} onClick={refresh}>
            Retry parent choices
          </Button>
        </>
      ) : result.state === 'pending' ? (
        <Typography aria-label="Parent choices" role="status">
          Loading parent choices…
        </Typography>
      ) : result.nextCursor ? (
        <Button
          disabled={busy || query.isFetching}
          onClick={() => {
            void query.fetchNextPage({ cancelRefetch: false });
          }}
        >
          Load more parent choices
        </Button>
      ) : null}
    </Stack>
  );
}
