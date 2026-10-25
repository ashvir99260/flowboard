'use client';

import type { ResolvedField, Task } from '@flowboard/contracts';
import { BoardItem, Button, CustomFieldChip, KanbanCard, WorkspaceIcon } from '@flowboard/ui';
import { Draggable } from '@hello-pangea/dnd';
import { useTaskEditor } from '../tasks/useTaskEditor';

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
            onOpen={() => openTask(task.id)}
            dragHandle={
              <Button
                {...provided.dragHandleProps}
                data-drag-task={task.id}
                aria-label={`Drag task: ${task.title}`}
                disabled={pending}
                title="Drag task"
                sx={{ touchAction: 'none', minWidth: '3.2rem', px: 0.4 }}
              >
                <WorkspaceIcon name="menu" />
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
