'use client';

import ButtonBase from '@mui/material/ButtonBase';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';

import { AssigneeAvatarGroup } from './assignee-avatar-group.js';
import { DueDateLabel } from './due-date-label.js';
import { PriorityBadge } from './priority-badge.js';

import type { Task } from '@flowboard/contracts';
import type { ReactNode } from 'react';

export function KanbanCard({
  actions,
  dragHandle,
  metadata,
  onOpen,
  task,
}: Readonly<{
  actions?: ReactNode;
  dragHandle?: ReactNode;
  metadata?: ReactNode;
  onOpen: () => void;
  task: Pick<Task, 'id' | 'title' | 'priority' | 'dueDate' | 'assignees'>;
}>) {
  return (
    <Paper
      component="article"
      aria-label={task.title}
      variant="outlined"
      sx={{ p: 3, minWidth: 0 }}
    >
      {dragHandle}
      <ButtonBase
        onClick={onOpen}
        sx={{
          minHeight: 44,
          width: '100%',
          justifyContent: 'flex-start',
          textAlign: 'left',
          fontWeight: 600,
          overflowWrap: 'anywhere',
        }}
      >
        {task.title}
      </ButtonBase>
      <Stack
        direction="row"
        useFlexGap
        spacing={2}
        sx={{ flexWrap: 'wrap', alignItems: 'center', my: 2 }}
      >
        <PriorityBadge priority={task.priority} />
        <DueDateLabel date={task.dueDate} />
      </Stack>
      <AssigneeAvatarGroup assignees={task.assignees} />
      {metadata && <Stack sx={{ mt: 2, minWidth: 0 }}>{metadata}</Stack>}
      {actions && (
        <Stack direction="row" useFlexGap spacing={2} sx={{ mt: 2, flexWrap: 'wrap' }}>
          {actions}
        </Stack>
      )}
    </Paper>
  );
}
