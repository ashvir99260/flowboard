'use client';

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CustomFieldChip, EmptyState, KanbanCard, KanbanColumn } from '@flowboard/ui';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useState } from 'react';

import { useTaskEditor } from '../tasks/task-drawer';

import type { BoardColumn } from './board-data';
import type { CollisionDetection, DragEndEvent } from '@dnd-kit/core';
import type { Placement, ResolvedField, Task } from '@flowboard/contracts';
import type { ReactNode } from 'react';

type Props = {
  action: (column: BoardColumn) => ReactNode;
  columns: readonly BoardColumn[];
  fields: readonly ResolvedField[];
  move: (task: Task, statusId: string, placement: Placement) => void;
  open: (task: Task, statusId: string) => void;
  pending: ReadonlySet<string>;
};
const collision: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  const cards = underPointer.filter((entry) => !String(entry.id).startsWith('column:'));
  if (args.pointerCoordinates) return cards.length ? cards : underPointer;

  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (container) => !String(container.id).startsWith('column:') || container.data.current?.empty,
    ),
  });
};

function describeTarget(columns: readonly BoardColumn[], id: string | number) {
  const column = columns.find(
    (item) => `column:${item.status.id}` === id || item.tasks.some((task) => task.id === id),
  );
  if (!column) return 'the board';

  const index = column.tasks.findIndex((task) => task.id === id);
  const task = column.tasks[index];

  return task
    ? `${task.title}, ${column.status.name}, position ${index + 1} of ${column.tasks.length} loaded tasks`
    : `${column.status.name} column`;
}

function Card({
  task,
  fields,
  pending,
  open,
  reduced,
}: {
  fields: readonly ResolvedField[];
  open: () => void;
  pending: boolean;
  reduced: boolean;
  task: Task;
}) {
  const openTask = useTaskEditor();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: pending });
  const field = fields.find(({ key }) => Object.hasOwn(task.customFields, key));

  return (
    <Box
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: reduced ? 'none' : transition,
      }}
      sx={{ opacity: isDragging ? 0.35 : 1 }}
    >
      <KanbanCard
        task={task}
        dragHandle={
          <Button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            data-drag-task={task.id}
            aria-label={`Drag task: ${task.title}`}
            disabled={pending}
            sx={{ touchAction: 'none', mb: 1 }}
          >
            Drag
          </Button>
        }
        metadata={
          field ? <CustomFieldChip field={field} value={task.customFields[field.key]} /> : undefined
        }
        actions={
          <>
            <Button
              data-open-task={task.id}
              aria-label={`Open task: ${task.title}`}
              onClick={() => openTask(task.id)}
            >
              Details
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
    </Box>
  );
}

function Column({
  column,
  children,
  action,
}: {
  action: ReactNode;
  children: ReactNode;
  column: BoardColumn;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${column.status.id}`,
    data: { empty: column.tasks.length === 0 },
  });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        borderRadius: 2,
        outline: isOver ? '2px solid' : undefined,
        outlineColor: 'primary.main',
        minHeight: 160,
      }}
    >
      <KanbanColumn status={column.status} count={column.tasks.length} action={action}>
        {children}
      </KanbanColumn>
    </Box>
  );
}

export function BoardDnd({ columns, fields, move, open, pending, action }: Props) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      scrollBehavior: reduced ? 'auto' : 'smooth',
    }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const tasks = columns.flatMap((column) => column.tasks);
  const active = tasks.find((task) => task.id === activeId);
  const title = (id: string | number) => tasks.find((task) => task.id === id)?.title ?? 'Task';
  const finish = ({ active: dragged, over }: DragEndEvent) => {
    setActiveId(null);
    const task = tasks.find((item) => item.id === dragged.id);
    if (!task || !over || pending.has(task.id) || over.id === dragged.id) return;

    const targetTask = tasks.find((item) => item.id === over.id);
    const targetColumn = columns.find(
      (column) =>
        column.status.id === (targetTask?.statusId ?? String(over.id).replace('column:', '')),
    );
    if (!targetColumn) return;

    const translated = dragged.rect.current.translated;
    const after =
      targetTask && task.statusId === targetTask.statusId
        ? targetColumn.tasks.findIndex((item) => item.id === task.id) <
          targetColumn.tasks.findIndex((item) => item.id === targetTask.id)
        : translated
          ? translated.top + translated.height / 2 >= over.rect.top + over.rect.height / 2
          : false;
    const last = targetColumn.tasks.filter((item) => item.id !== task.id).at(-1);
    const placement: Placement = targetTask
      ? after
        ? { afterId: targetTask.id }
        : { beforeId: targetTask.id }
      : last
        ? { afterId: last.id }
        : { edge: 'start' };
    move(task, targetColumn.status.id, placement);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={({ active: dragged }) => setActiveId(String(dragged.id))}
      onDragEnd={finish}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'Press Space or Enter to pick up a task. Use arrow keys to move. Press Space or Enter to drop, or Escape to cancel. The Move button offers the same actions without dragging.',
        },
        announcements: {
          onDragStart: ({ active: dragged }) => `Picked up ${describeTarget(columns, dragged.id)}.`,
          onDragOver: ({ active: dragged, over }) =>
            over?.id === dragged.id
              ? undefined
              : over
                ? `Over ${describeTarget(columns, over.id)}.`
                : 'Outside the board.',
          onDragEnd: ({ active: dragged, over }) =>
            over && over.id !== dragged.id
              ? `Dropped ${title(dragged.id)}. Saving the requested move.`
              : 'No move requested.',
          onDragCancel: () => 'Move cancelled.',
        },
      }}
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
        {columns.map((column) => (
          <Column key={column.status.id} column={column} action={action(column)}>
            <SortableContext
              items={column.tasks.map((task) => task.id)}
              strategy={verticalListSortingStrategy}
            >
              {column.tasks.length ? (
                column.tasks.map((task) => (
                  <Card
                    key={task.id}
                    task={task}
                    fields={fields}
                    pending={pending.has(task.id)}
                    reduced={reduced}
                    open={() => open(task, column.status.id)}
                  />
                ))
              ) : (
                <EmptyState description="Tasks in this status appear here." title="No tasks" />
              )}
            </SortableContext>
          </Column>
        ))}
      </Box>
      <DragOverlay dropAnimation={reduced ? null : undefined}>
        {active ? (
          <Box aria-hidden="true">
            <KanbanCard task={active} />
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
