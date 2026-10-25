'use client';

import { Button, Stack, Typography } from '@flowboard/ui';

import { BulkTaskActions } from './BulkTaskActions';
import { ListResult } from './ListResult';
import { ListToolbar } from './ListToolbar';
import { useBulkTaskSelection } from './useBulkTaskSelection';
import { useListQuery } from './useListQuery';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { TaskTableQuery } from './listLocation';

export function ConnectedList({
  listId,
  runtime,
  scope,
  query,
  onChange,
  pending,
}: {
  listId: string;
  onChange: (query: TaskTableQuery) => void;
  pending: boolean;
  query: TaskTableQuery;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const view = useListQuery({ listId, runtime, scope, query });
  const selection = useBulkTaskSelection(view.result.state === 'ready' ? view.result.items : []);

  return (
    <Stack spacing={1.2} sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 0.8 }}
      >
        <Typography component="h2" variant="h2">
          Tasks
        </Typography>
        <Button disabled={pending} onClick={view.retry}>
          Refresh tasks
        </Button>
      </Stack>
      <ListToolbar
        fields={view.fields}
        configured={view.configured}
        query={query}
        onChange={onChange}
        pending={pending}
      />
      <BulkTaskActions
        listId={listId}
        runtime={runtime}
        scope={scope}
        tasks={selection.selectedTasks}
        onSaved={selection.clear}
        onClear={selection.clear}
      />
      <ListResult
        view={view}
        selection={{ ids: selection.selectedIds, onChange: selection.select, disabled: pending }}
      />
    </Stack>
  );
}
