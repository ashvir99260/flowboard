'use client';

import { Button, Stack, Typography } from '@flowboard/ui';

import { BulkTaskActions } from './BulkTaskActions';
import { writeListLocation } from './listLocation';
import { ListResult } from './ListResult';
import { ListToolbar } from './ListToolbar';
import { useBulkTaskSelection } from './useBulkTaskSelection';
import { useListQuery } from './useListQuery';

import type { TaskTableQuery } from './listLocation';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';

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
  const selection = useBulkTaskSelection(
    view.result.state === 'ready' ? view.result.items : [],
    writeListLocation(query),
  );

  return (
    <Stack
      component="section"
      aria-label="List view"
      aria-busy={view.refreshing}
      spacing={1.2}
      sx={{ minWidth: 0 }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 0.8 }}
      >
        <Typography component="h2" variant="h2">
          Tasks
        </Typography>
        <Button disabled={pending || view.refreshing} onClick={view.retry}>
          Refresh tasks
        </Button>
      </Stack>
      <ListToolbar query={query} onChange={onChange} pending={pending} />
      {selection.selectedTasks.length > 0 && (
        <BulkTaskActions
          listId={listId}
          runtime={runtime}
          scope={scope}
          tasks={selection.selectedTasks}
          onSaved={selection.clear}
          onClear={selection.clear}
        />
      )}
      <ListResult
        view={view}
        query={query}
        onChange={onChange}
        pending={pending}
        selection={{ ids: selection.selectedIds, onChange: selection.select, disabled: pending }}
      />
    </Stack>
  );
}
