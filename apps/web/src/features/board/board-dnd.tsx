'use client';

import { Button, useMediaQuery } from '@flowboard/ui';
import {
  BoardDropzone,
  BoardGrid,
  BoardItem,
  CustomFieldChip,
  EmptyState,
  KanbanCard,
  KanbanColumn,
} from '@flowboard/ui';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';

import { useTaskEditor } from '../tasks/task-drawer';

import type { BoardColumn } from './board-data';
import type { Placement, ResolvedField, Task } from '@flowboard/contracts';
import type { DraggableLocation, DropResult, ResponderProvided } from '@hello-pangea/dnd';
import type { ReactNode } from 'react';

type Props = {
  action: (column: BoardColumn) => ReactNode;
  columns: readonly BoardColumn[];
  fields: readonly ResolvedField[];
  move: (task: Task, statusId: string, placement: Placement) => void;
  open: (task: Task, statusId: string) => void;
  pending: ReadonlySet<string>;
};

function describeLocation(columns: readonly BoardColumn[], location: DraggableLocation) {
  const column = columns.find((item) => item.status.id === location.droppableId);

  return `${column?.status.name ?? 'the board'}, position ${location.index + 1}`;
}

function Card({
  task,
  index,
  fields,
  pending,
  open,
  reduced,
}: {
  fields: readonly ResolvedField[];
  index: number;
  open: () => void;
  pending: boolean;
  reduced: boolean;
  task: Task;
}) {
  const openTask = useTaskEditor();

  const field = fields.find(({ key }) => Object.hasOwn(task.customFields, key));

  return (
    <Draggable
      draggableId={task.id}
      index={index}
      isDragDisabled={pending}
      disableInteractiveElementBlocking
    >
      {(provided, snapshot) => (
        <BoardItem
          ref={provided.innerRef}
          {...provided.draggableProps}
          style={{
            ...provided.draggableProps.style,
            ...(reduced
              ? snapshot.isDropAnimating
                ? { transitionDuration: '0.001s' }
                : { transition: 'none' }
              : {}),
          }}
        >
          <KanbanCard
            task={task}
            dragHandle={
              <Button
                {...provided.dragHandleProps}
                data-drag-task={task.id}
                aria-label={`Drag task: ${task.title}`}
                disabled={pending}
                sx={{ touchAction: 'none', mb: 0.4 }}
              >
                Drag
              </Button>
            }
            metadata={
              field ? (
                <CustomFieldChip field={field} value={task.customFields[field.key]} />
              ) : undefined
            }
            actions={
              <>
                <Button
                  data-open-task={task.id}
                  aria-label={`Open task: ${task.title}`}
                  onClick={() => openTask(task.id)}
                >
                  Open task
                </Button>
                <Button
                  data-move-task={task.id}
                  aria-label={`Move task: ${task.title}`}
                  disabled={pending}
                  onClick={open}
                >
                  Move
                </Button>
              </>
            }
          />
        </BoardItem>
      )}
    </Draggable>
  );
}

export function BoardDnd({ columns, fields, move, open, pending, action }: Props) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');

  const tasks = columns.flatMap((column) => column.tasks);
  const title = (id: string) => tasks.find((task) => task.id === id)?.title ?? 'Task';
  const restoreFocus = (id: string) => {
    const target = document.querySelector<HTMLElement>(`[data-drag-task="${CSS.escape(id)}"]`);
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
    });
  };
  const finish = (
    { draggableId, source, destination, reason }: DropResult,
    provided: ResponderProvided,
  ) => {
    if (reason === 'CANCEL' || !destination) {
      restoreFocus(draggableId);
      provided.announce('Move cancelled.');

      return;
    }

    const task = tasks.find((item) => item.id === draggableId);
    const column = columns.find((item) => item.status.id === destination.droppableId);
    if (
      !task ||
      !column ||
      pending.has(task.id) ||
      (source.droppableId === destination.droppableId && source.index === destination.index)
    ) {
      restoreFocus(draggableId);
      provided.announce('No move requested.');

      return;
    }

    const peers = column.tasks.filter((item) => item.id !== task.id);
    const index = Math.max(0, Math.min(destination.index, peers.length));
    const next = peers[index];
    const previous = index > 0 ? peers[index - 1] : undefined;
    const placement: Placement = next
      ? { beforeId: next.id }
      : previous
        ? { afterId: previous.id }
        : { edge: 'start' };
    move(task, column.status.id, placement);
    provided.announce(`Dropped ${task.title}. Saving the requested move.`);
  };

  return (
    <DragDropContext
      onDragEnd={finish}
      onDragStart={({ draggableId, source }, provided) =>
        provided.announce(`Picked up ${title(draggableId)}, ${describeLocation(columns, source)}.`)
      }
      onDragUpdate={({ destination }, provided) =>
        provided.announce(
          destination ? `Over ${describeLocation(columns, destination)}.` : 'Outside the board.',
        )
      }
      dragHandleUsageInstructions="Press Space to pick up a task. Use arrow keys to move. Press Space to drop, or Escape to cancel. The Move button offers the same actions without dragging."
    >
      <BoardGrid>
        {columns.map((column) => (
          <KanbanColumn
            key={column.status.id}
            status={column.status}
            count={column.tasks.length}
            action={action(column)}
          >
            <Droppable droppableId={column.status.id}>
              {(provided, snapshot) => (
                <BoardDropzone
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  data-highlighted={snapshot.isDraggingOver}
                >
                  {column.tasks.length ? (
                    column.tasks.map((task, index) => (
                      <Card
                        key={task.id}
                        task={task}
                        index={index}
                        fields={fields}
                        pending={pending.has(task.id)}
                        reduced={reduced}
                        open={() => open(task, column.status.id)}
                      />
                    ))
                  ) : !snapshot.isUsingPlaceholder ? (
                    <EmptyState description="Tasks in this status appear here." title="No tasks" />
                  ) : null}
                  {provided.placeholder}
                </BoardDropzone>
              )}
            </Droppable>
          </KanbanColumn>
        ))}
      </BoardGrid>
    </DragDropContext>
  );
}
