'use client';

import { useEffect, useRef, useState } from 'react';

import { BoardContent } from './BoardContent';
import { MoveMenu } from './MoveMenu';
import { projectPlacements } from './taskPlacement';
import { useBoard } from './useBoard';
import { useTaskPlacementMutation } from './useTaskPlacementMutation';

import type { Selection } from './boardTypes';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { Placement, Task } from '@flowboard/contracts';

export function ConnectedBoard({
  listId,
  runtime,
  scope,
}: {
  listId: string;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const board = useBoard({ listId, runtime, scope });
  const { pending, submit } = useTaskPlacementMutation(runtime, scope);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const focusTask = useRef<{ id: string; kind: 'drag' | 'move' } | null>(null);

  const requestFocus = (id: string, kind: 'drag' | 'move') => {
    focusTask.current = { id, kind };
    setFocusTick((value) => value + 1);
  };

  const refreshing = board.state === 'ready' && board.refreshing;

  useEffect(() => {
    if (refreshing || board.state !== 'ready' || selection || !focusTask.current) return;

    const { id, kind } = focusTask.current;
    const element =
      document.querySelector<HTMLElement>(`[data-${kind}-task="${id}"]`) ??
      document.querySelector<HTMLElement>('[aria-label="Task board"]');
    element?.focus();
    focusTask.current = null;
  }, [board.state, focusTick, refreshing, selection]);

  const projected =
    board.state === 'ready'
      ? { ...board, columns: projectPlacements(board.columns, listId, pending) }
      : board;
  const move = (task: Task, statusId: string, placement: Placement) => {
    if (board.state !== 'ready' || board.refreshing) return;

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
      <BoardContent
        board={projected}
        open={setSelection}
        move={move}
        pending={
          new Set([
            ...pending.map((command) => command.taskId),
            ...(board.state === 'ready' && board.refreshing
              ? board.columns.flatMap((column) => column.tasks.map((task) => task.id))
              : []),
          ])
        }
      />
      {selection && (
        <MoveMenu
          task={selection.task}
          sourceStatus={selection.status}
          configVersion={selection.configVersion}
          columns={board.state === 'ready' ? board.columns : []}
          runtime={runtime}
          scope={scope}
          submit={(command) =>
            board.state === 'ready' && !board.refreshing
              ? submit(command)
              : Promise.resolve({
                  success: false as const,
                  error: { code: 'BUSY', message: 'Wait for the board to finish refreshing.' },
                })
          }
          onClose={() => {
            requestFocus(selection.task.id, 'move');
            setSelection(null);
          }}
        />
      )}
    </>
  );
}
