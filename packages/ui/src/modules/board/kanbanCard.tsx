'use client';

import ButtonBase from '@mui/material/ButtonBase';
import { styled } from '@mui/material/styles';

import { Paper, Stack, Typography } from '../../primitives.js';
import { AssigneeAvatarGroup } from '../tasks/assigneeAvatarGroup.js';
import { DueDateLabel } from '../tasks/dueDateLabel.js';
import { PriorityBadge } from '../tasks/priorityBadge.js';

import type { Task } from '@flowboard/contracts';
import type { ReactNode } from 'react';

const Card = styled(Paper, { name: 'FlowboardKanbanCard', slot: 'Root' })(({ theme }) => ({
  padding: theme.spacing(1.2),
  minWidth: 0,
})) as typeof Paper;
const OpenTitle = styled(ButtonBase)(({ theme }) => ({
  minHeight: '4.4rem',
  width: '100%',
  justifyContent: 'flex-start',
  textAlign: 'left',
  fontWeight: 600,
  overflowWrap: 'anywhere',
  borderRadius: theme.shape.borderRadius,
}));
const Title = styled(Typography)({
  minHeight: '4.4rem',
  fontWeight: 600,
  overflowWrap: 'anywhere',
}) as typeof Typography;
const Summary = styled(Stack)(({ theme }) => ({
  flexWrap: 'wrap',
  alignItems: 'center',
  marginBlock: theme.spacing(0.8),
}));
const Metadata = styled(Stack)(({ theme }) => ({ marginTop: theme.spacing(0.8), minWidth: 0 }));
const Actions = styled(Stack)(({ theme }) => ({ marginTop: theme.spacing(0.8), flexWrap: 'wrap' }));

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
      <Summary direction="row" useFlexGap spacing={0.8}>
        <PriorityBadge priority={task.priority} />
        <DueDateLabel date={task.dueDate} />
      </Summary>
      <AssigneeAvatarGroup assignees={task.assignees} />
      {metadata && <Metadata>{metadata}</Metadata>}
      {actions && (
        <Actions direction="row" spacing={0.8} useFlexGap>
          {actions}
        </Actions>
      )}
    </Card>
  );
}
