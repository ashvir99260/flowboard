'use client';

import {
  BoardItem,
  Button,
  CustomFieldChip,
  KanbanCard,
  Stack,
  StatusChip,
  WorkspaceIcon,
} from '@flowboard/ui';
import { Draggable } from '@hello-pangea/dnd';

import { useTaskEditor } from '../tasks/useTaskEditor';

import type { WorkspaceBoardColumn } from './workspaceBoardData';
import type { Task } from '@flowboard/contracts';

export function WorkspaceTaskCard({
  task,
  column,
  index,
  pending,
  reduced,
  openMove,
}: {
  column: WorkspaceBoardColumn;
  index: number;
  openMove: () => void;
  pending: boolean;
  reduced: boolean;
  task: Task;
}) {
  const openTask = useTaskEditor();

  const status = column.statuses.find((item) => item.id === task.statusId)!;
  const field = column.fields.find((item) => Object.hasOwn(task.customFields, item.key));

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
            onOpen={() => openTask(task.id, task.primaryListId)}
            metadata={
              <Stack direction="row" useFlexGap spacing={0.4} sx={{ flexWrap: 'wrap' }}>
                <StatusChip status={status} />
                {field && <CustomFieldChip field={field} value={task.customFields[field.key]} />}
              </Stack>
            }
            actions={
              <>
                <Button
                  data-move-task={task.id}
                  aria-label={`Move task: ${task.title}`}
                  disabled={pending}
                  onClick={openMove}
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
