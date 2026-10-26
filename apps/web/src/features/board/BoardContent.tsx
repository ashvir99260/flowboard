'use client';

import { BoardSkeleton, BoardViewport, Button, ErrorState, Stack, Typography } from '@flowboard/ui';

import { BoardDnd } from './BoardDnd';
import { useBoard } from './useBoard';

import type { Selection } from './boardTypes';
import type { Placement, Task } from '@flowboard/contracts';

export function BoardContent({
  board,
  open,
  move,
  pending,
}: {
  board: ReturnType<typeof useBoard>;
  move: (task: Task, statusId: string, placement: Placement) => void;
  open: (selection: Selection) => void;
  pending: ReadonlySet<string>;
}) {
  if (board.state === 'loading') return <BoardSkeleton />;

  if (board.state === 'error')
    return (
      <ErrorState
        title={board.title}
        description={board.message}
        action={<Button onClick={board.retry}>Retry board</Button>}
      />
    );

  return (
    <Stack spacing={1.2} sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 0.8 }}
      >
        <Typography component="h2" variant="h2">
          Board
        </Typography>
        <Button disabled={board.refreshing} onClick={board.retry}>
          Refresh board
        </Button>
      </Stack>
      <BoardViewport
        role="region"
        aria-label="Task board"
        aria-busy={board.refreshing}
        tabIndex={0}
      >
        <BoardDnd
          columns={board.columns}
          fields={board.fields}
          pending={pending}
          move={move}
          open={(task, statusId) => {
            const column = board.columns.find((item) => item.status.id === statusId);
            if (column) open({ task, status: column.status, configVersion: board.configVersion });
          }}
          action={({ status, nextCursor }) =>
            nextCursor ? (
              <Button
                disabled={
                  board.refreshing || board.loading.has(status.id) || board.atLimit.has(status.id)
                }
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
        />
      </BoardViewport>
    </Stack>
  );
}
