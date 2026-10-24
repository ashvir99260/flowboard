'use client';

import { CustomFieldChip, EmptyState, ErrorState, KanbanCard, KanbanColumn } from '@flowboard/ui';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useSession } from '../../providers/app-providers';

import { useBoard } from './use-board';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';

function ConnectedBoard({
  listId,
  runtime,
  scope,
}: {
  listId: string;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const board = useBoard({ listId, runtime, scope });
  if (board.state === 'loading')
    return (
      <Stack role="status" direction="row" spacing={2} sx={{ alignItems: 'center', p: 4 }}>
        <CircularProgress aria-hidden="true" size={20} />
        <Typography>Loading board…</Typography>
      </Stack>
    );

  if (board.state === 'error')
    return (
      <ErrorState
        title={board.title}
        description={board.message}
        action={<Button onClick={board.retry}>Retry board</Button>}
      />
    );

  return (
    <Stack spacing={3} sx={{ minWidth: 0 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Typography component="h2" variant="h2">
          Board
        </Typography>
        <Button onClick={board.retry}>Refresh board</Button>
      </Stack>
      <Box
        role="region"
        aria-label="Task board"
        tabIndex={0}
        sx={{ overflowX: 'auto', maxWidth: '100%', minWidth: 0, pb: 3 }}
      >
        <Box
          sx={{
            display: 'grid',
            gridAutoFlow: 'column',
            gridAutoColumns: 'minmax(260px, 320px)',
            alignItems: 'start',
            gap: 3,
          }}
        >
          {board.columns.map(({ status, tasks, nextCursor }) => (
            <KanbanColumn
              key={status.id}
              status={status}
              count={tasks.length}
              action={
                nextCursor ? (
                  <Button
                    disabled={board.loading.has(status.id) || board.atLimit.has(status.id)}
                    aria-label={`Load more ${status.name} tasks`}
                    onClick={() => board.loadMore(status.id)}
                  >
                    {board.atLimit.has(status.id)
                      ? 'Page limit reached'
                      : board.loading.has(status.id)
                        ? 'Loading…'
                        : 'Load more'}
                  </Button>
                ) : undefined
              }
            >
              {tasks.length ? (
                tasks.map((task) => {
                  const field = board.fields.find(({ key }) =>
                    Object.hasOwn(task.customFields, key),
                  );

                  return (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      metadata={
                        field ? (
                          <CustomFieldChip field={field} value={task.customFields[field.key]} />
                        ) : undefined
                      }
                    />
                  );
                })
              ) : (
                <EmptyState description="Tasks in this status appear here." title="No tasks" />
              )}
            </KanbanColumn>
          ))}
        </Box>
      </Box>
    </Stack>
  );
}

export function Board({ listId }: { listId: string }) {
  const { runtime, scope } = useSession();

  return runtime && scope ? (
    <ConnectedBoard
      key={`${scope.revision}:${scope.userId}:${scope.workspaceId}:${listId}`}
      listId={listId}
      runtime={runtime}
      scope={scope}
    />
  ) : null;
}
