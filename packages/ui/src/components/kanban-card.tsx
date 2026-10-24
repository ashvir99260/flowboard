'use client';

import ButtonBase from '@mui/material/ButtonBase';
import { styled } from '@mui/material/styles';

import { Paper, Stack, Typography } from '../primitives.js';

import { AssigneeAvatarGroup } from './assignee-avatar-group.js';
import { DueDateLabel } from './due-date-label.js';
import { PriorityBadge } from './priority-badge.js';

import type { Task } from '@flowboard/contracts';
import type { ReactNode } from 'react';

const Card = styled(Paper, { name: 'FlowboardKanbanCard', slot: 'Root' })(({ theme }) => ({
  padding: theme.spacing(3),
  minWidth: 0,
})) as typeof Paper;
const OpenTitle = styled(ButtonBase)(({ theme }) => ({
  minHeight: 44,
  width: '100%',
  justifyContent: 'flex-start',
  textAlign: 'left',
  fontWeight: 600,
  overflowWrap: 'anywhere',
  borderRadius: theme.shape.borderRadius,
}));
const Title = styled(Typography)({
  minHeight: 44,
  fontWeight: 600,
  overflowWrap: 'anywhere',
}) as typeof Typography;
const Summary = styled(Stack)(({ theme }) => ({
  flexWrap: 'wrap',
  alignItems: 'center',
  marginBlock: theme.spacing(2),
}));
const Metadata = styled(Stack)(({ theme }) => ({ marginTop: theme.spacing(2), minWidth: 0 }));
const Actions = styled(Stack)(({ theme }) => ({ marginTop: theme.spacing(2), flexWrap: 'wrap' }));

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
  onOpen?: () => void;
  task: Pick<Task, 'id' | 'title' | 'priority' | 'dueDate' | 'assignees'>;
}>) {
  return (
    <Card component="article" aria-label={task.title} variant="outlined">
      {dragHandle}
      {onOpen ? (
        <OpenTitle onClick={onOpen}>{task.title}</OpenTitle>
      ) : (
        <Title component="h3" variant="body1">
          {task.title}
        </Title>
      )}
      <Summary direction="row" useFlexGap spacing={2}>
        <PriorityBadge priority={task.priority} />
        <DueDateLabel date={task.dueDate} />
      </Summary>
      <AssigneeAvatarGroup assignees={task.assignees} />
      {metadata && <Metadata>{metadata}</Metadata>}
      {actions && (
        <Actions direction="row" spacing={2} useFlexGap>
          {actions}
        </Actions>
      )}
    </Card>
  );
}
