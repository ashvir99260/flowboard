'use client';

import {
  BoardDropzone,
  BoardGrid,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  useMediaQuery,
  WorkspaceColumn,
} from '@flowboard/ui';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import NextLink from 'next/link';

import { WorkspaceTaskCard } from './WorkspaceTaskCard';

import type { WorkspaceColumnState } from './useWorkspaceBoardQuery';
import type { WorkspaceBoardColumn } from './workspaceBoardData';
import type { Task } from '@flowboard/contracts';
import type { DropResult, ResponderProvided } from '@hello-pangea/dnd';

export function WorkspaceBoardDnd({
  columns,
  pending,
  move,
  openMove,
  retry,
  loadMore,
  workspaceId,
}: {
  columns: readonly WorkspaceColumnState[];
  loadMore: (listId: string) => void;
  move: (taskId: string, listId: string, index: number) => void;
  openMove: (task: Task, column: WorkspaceBoardColumn) => void;
  pending: ReadonlySet<string>;
  retry: (listId: string) => void;
  workspaceId: string;
}) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');

  const restoreFocus = (taskId: string) =>
    requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(
        `[data-drag-task="${CSS.escape(taskId)}"]`,
      );
      element?.focus();
    });
  const finish = (
    { draggableId, source, destination, reason }: DropResult,
    provided: ResponderProvided,
  ) => {
    if (reason === 'CANCEL' || !destination) {
      restoreFocus(draggableId);
      provided.announce('Move cancelled.');

      return;
    }

    if (
      pending.has(draggableId) ||
      (source.droppableId === destination.droppableId && source.index === destination.index)
    ) {
      restoreFocus(draggableId);
      provided.announce('No move requested.');

      return;
    }

    move(draggableId, destination.droppableId, destination.index);
    provided.announce('Requested move. Tasks remain grouped by status in each list.');
  };

  return (
    <DragDropContext
      onDragEnd={finish}
      dragHandleUsageInstructions="Press Space to pick up a task. Use arrow keys to move between lists or within its status group. Press Space to drop or Escape to cancel. Use Move for a form alternative."
      onDragStart={({ source }, provided) =>
        provided.announce(
          `Picked up a task in ${columns.find((column) => column.list.id === source.droppableId)?.list.name ?? 'this list'}.`,
        )
      }
      onDragUpdate={({ destination }, provided) =>
        provided.announce(
          destination
            ? `Over ${columns.find((column) => column.list.id === destination.droppableId)?.list.name ?? 'a list'}, position ${destination.index + 1}.`
            : 'Outside the board.',
        )
      }
    >
      <BoardGrid>
        {columns.map((column) => (
          <WorkspaceColumn
            key={column.list.id}
            name={column.list.name}
            count={column.state === 'ready' ? column.tasks.length : 0}
            actions={
              <Button
                component={NextLink}
                href={`/w/${workspaceId}/lists/${column.list.id}`}
                aria-label={`Open ${column.list.name} status board`}
              >
                Open list
              </Button>
            }
          >
            {column.state === 'loading' ? (
              <LoadingState>Loading list…</LoadingState>
            ) : column.state === 'error' ? (
              <ErrorState
                title="List unavailable"
                description={column.message}
                action={<Button onClick={() => retry(column.list.id)}>Retry list</Button>}
              />
            ) : (
              <>
                <Droppable droppableId={column.list.id}>
                  {(provided, snapshot) => (
                    <BoardDropzone
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      data-highlighted={snapshot.isDraggingOver}
                    >
                      {column.tasks.map((task, index) => (
                        <WorkspaceTaskCard
                          key={task.id}
                          task={task}
                          column={column}
                          index={index}
                          pending={pending.has(task.id)}
                          reduced={reduced}
                          openMove={() => openMove(task, column)}
                        />
                      ))}
                      {!column.tasks.length && !snapshot.isUsingPlaceholder && (
                        <EmptyState
                          description="Drop a task here or create one in this list."
                          title="No tasks"
                        />
                      )}
                      {provided.placeholder}
                    </BoardDropzone>
                  )}
                </Droppable>
                {column.nextCursor && (
                  <Button
                    disabled={column.loadingMore || column.atLimit}
                    onClick={() => loadMore(column.list.id)}
                    aria-label={`Load more ${column.list.name} tasks`}
                  >
                    {column.atLimit
                      ? 'Page limit reached'
                      : column.loadingMore
                        ? 'Loading…'
                        : 'Load more'}
                  </Button>
                )}
              </>
            )}
          </WorkspaceColumn>
        ))}
      </BoardGrid>
    </DragDropContext>
  );
}
