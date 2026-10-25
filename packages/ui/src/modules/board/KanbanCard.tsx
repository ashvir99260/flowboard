'use client';

import ButtonBase from '@mui/material/ButtonBase';
import { default as Stack } from '@mui/material/Stack';
import { styled } from '@mui/material/styles';
import { default as Typography } from '@mui/material/Typography';

import { Paper } from '../primitives/Paper.js';
import { AssigneeAvatarGroup } from '../tasks/AssigneeAvatarGroup.js';
import { DueDateLabel } from '../tasks/DueDateLabel.js';
import { PriorityBadge } from '../tasks/PriorityBadge.js';

import type { Task } from '@flowboard/contracts';
import type { ReactNode } from 'react';

const Card = styled(Paper, { name: 'FlowboardKanbanCard', slot: 'Root' })(({ theme }) => ({
  padding: theme.spacing(1),
  minWidth: 0,
  borderRadius: 8,
  backgroundColor: (theme.vars ?? theme).palette.background.paper,
  '&:hover': { boxShadow: theme.shadows[1] },
})) as typeof Paper;
const Header = styled('div')(({ theme }) => ({
  alignItems: 'flex-start',
  display: 'flex',
  gap: theme.spacing(0.4),
}));
const DragHandle = styled('div')({ display: 'flex', flexShrink: 0 });
const ActionHeading = styled('h3')({ display: 'flex', flex: 1, margin: 0, minWidth: 0 });
const OpenTitle = styled(ButtonBase)(({ theme }) => ({
  minHeight: '3.6rem',
  minWidth: 0,
  flex: 1,
  justifyContent: 'flex-start',
  textAlign: 'left',
  fontSize: '1.3rem',
  fontWeight: 550,
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
  borderRadius: theme.shape.borderRadius,
  '@media (pointer: coarse)': { minHeight: '4.4rem' },
}));
const TitleText = styled('span')({
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
});
const Title = styled(Typography)({
  display: '-webkit-box',
  flex: 1,
  minWidth: 0,
  fontSize: '1.3rem',
  fontWeight: 550,
  lineHeight: 1.5,
  overflow: 'hidden',
  overflowWrap: 'anywhere',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
}) as typeof Typography;
const Summary = styled(Stack)(({ theme }) => ({
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-start',
  marginTop: theme.spacing(0.4),
}));
const Metadata = styled(Stack)(({ theme }) => ({
  alignItems: 'flex-start',
  marginTop: theme.spacing(0.6),
  minWidth: 0,
}));
const Actions = styled(Stack)(({ theme }) => ({
  marginTop: theme.spacing(0.4),
  flexWrap: 'wrap',
}));

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
    <Card
      component="article"
      aria-label={task.title}
      variant="outlined"
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          (event.target instanceof Element &&
            event.target.closest(
              'button,a,input,textarea,select,label,summary,[role="button"],[role="link"],[contenteditable="true"]',
            ))
        )
          return;

        onOpen?.();
      }}
    >
      <Header>
        {onOpen ? (
          <ActionHeading aria-label={task.title}>
            <OpenTitle
              aria-label={`Open task: ${task.title}`}
              data-open-task={task.id}
              onClick={onOpen}
              title={task.title}
            >
              <TitleText>{task.title}</TitleText>
            </OpenTitle>
          </ActionHeading>
        ) : (
          <Title component="h3" title={task.title} variant="body1">
            {task.title}
          </Title>
        )}
        {dragHandle && <DragHandle>{dragHandle}</DragHandle>}
      </Header>
      <Summary direction="row" useFlexGap spacing={0.8}>
        <PriorityBadge priority={task.priority} />
        {task.dueDate !== null && <DueDateLabel date={task.dueDate} variant="compact" />}
        <AssigneeAvatarGroup assignees={task.assignees} />
      </Summary>
      {metadata && <Metadata>{metadata}</Metadata>}
      {actions && (
        <Actions direction="row" spacing={0.8} useFlexGap>
          {actions}
        </Actions>
      )}
    </Card>
  );
}
