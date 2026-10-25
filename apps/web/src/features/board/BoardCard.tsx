'use client';

import { BoardItem, Button, CustomFieldChip, KanbanCard, WorkspaceIcon } from '@flowboard/ui';
import { Draggable } from '@hello-pangea/dnd';

import { useTaskEditor } from '../tasks/useTaskEditor';

import type { ResolvedField, Task } from '@flowboard/contracts';

export function BoardCard({
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
    <Draggable draggableId={task.id} index={index} isDragDisabled={pending}>
      {(provided, snapshot) => (
        <BoardItem
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          role="group"
          aria-label={`Drag task: ${task.title}`}
          aria-roledescription="draggable task"
          aria-disabled={pending}
          data-drag-task={task.id}
          style={{
            ...provided.draggableProps.style,
            cursor: pending ? 'default' : snapshot.isDragging ? 'grabbing' : 'grab',
            ...(reduced
              ? snapshot.isDropAnimating
                ? { transitionDuration: '0.001s' }
                : { transition: 'none' }
              : {}),
          }}
        >
          <KanbanCard
            task={task}
            onOpen={() => openTask(task.id)}
            metadata={
              field ? (
                <CustomFieldChip field={field} value={task.customFields[field.key]} />
              ) : undefined
            }
            actions={
              <>
                <Button
                  data-move-task={task.id}
                  aria-label={`Move task: ${task.title}`}
                  disabled={pending}
                  onClick={open}
                  title="Move task"
                  sx={{ minWidth: '3.2rem', px: 0.4 }}
                >
                  <WorkspaceIcon name="dots" />
                </Button>
              </>
            }
          />
        </BoardItem>
      )}
    </Draggable>
  );
}
