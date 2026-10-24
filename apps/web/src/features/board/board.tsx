'use client';

import { Button, Stack, Typography } from '@flowboard/ui';
import { BoardViewport, ErrorState, LoadingState } from '@flowboard/ui';
import { useEffect, useRef, useState } from 'react';

import { useSession } from '../../providers/app-providers';

import { BoardDnd } from './board-dnd';
import { MoveMenu } from './move-menu';
import { projectPlacements } from './task-placement';
import { useBoard } from './use-board';
import { useTaskMutation } from './use-task-mutation';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';
import type { Placement, ResolvedStatus, Task } from '@flowboard/contracts';

type Selection = { configVersion: number; status: ResolvedStatus; task: Task };

function BoardContent({
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
  if (board.state === 'loading') return <LoadingState>Loading board…</LoadingState>;

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
      <BoardViewport role="region" aria-label="Task board" tabIndex={0}>
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
        />
      </BoardViewport>
    </Stack>
  );
}

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
  const { pending, submit, notice } = useTaskMutation(runtime, scope);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const focusTask = useRef<{ id: string; kind: 'drag' | 'move' } | null>(null);
  const requestFocus = (id: string, kind: 'drag' | 'move') => {
    focusTask.current = { id, kind };
    setFocusTick((value) => value + 1);
  };
  useEffect(() => {
    if (board.state !== 'ready' || selection || !focusTask.current) return;

    const { id, kind } = focusTask.current;
    const element =
      document.querySelector<HTMLElement>(`[data-${kind}-task="${id}"]`) ??
      document.querySelector<HTMLElement>('[aria-label="Task board"]');
    element?.focus();
    focusTask.current = null;
  }, [board.state, focusTick, selection]);
  const projected =
    board.state === 'ready'
      ? { ...board, columns: projectPlacements(board.columns, listId, pending) }
      : board;
  const move = (task: Task, statusId: string, placement: Placement) => {
    if (board.state !== 'ready') return;

    void submit({
      taskId: task.id,
      sourceListId: task.primaryListId,
      sourceStatusId: task.statusId,
      request: {
        destinationListId: listId,
        statusId,
        placement,
        expectedVersion: task.version,
        expectedConfigVersion: board.configVersion,
      },
    }).then(() => requestFocus(task.id, 'drag'));
  };

  return (
    <>
      {notice && (
        <Typography role="status" sx={{ my: 2 }}>
          {notice}
        </Typography>
      )}
      <BoardContent
        board={projected}
        open={setSelection}
        move={move}
        pending={new Set(pending.map((command) => command.taskId))}
      />
      {selection && (
        <MoveMenu
          task={selection.task}
          sourceStatus={selection.status}
          configVersion={selection.configVersion}
          columns={board.state === 'ready' ? board.columns : []}
          runtime={runtime}
          scope={scope}
          submit={submit}
          onClose={() => {
            requestFocus(selection.task.id, 'move');
            setSelection(null);
          }}
        />
      )}
    </>
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
