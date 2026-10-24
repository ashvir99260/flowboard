'use client';

import { ActivitySchema, ResolvedStatusSchema, TaskSchema } from '@flowboard/contracts';
import {
  ActivityPanel,
  ActivityTimeline,
  Button,
  MarkdownContent,
  Surface,
  TaskTable,
  Toolbar,
  Typography,
} from '@flowboard/ui';
import { useState } from 'react';

// Development-only sample props, validated with the same public contracts as real data.
const status = ResolvedStatusSchema.parse(ResolvedStatusSchema.meta()?.example);
const task = TaskSchema.parse({
  ...(TaskSchema.meta()?.example as object),
  title: 'Review shared components',
  workspaceId: status.workspaceId,
  version: 2,
  statusId: status.id,
});
const activity = ActivitySchema.parse({
  ...(ActivitySchema.meta()?.example as object),
  taskId: task.id,
  workspaceId: task.workspaceId,
  payload: {
    beforeStatusId: '81000000-0000-4000-8000-000000000006',
    afterStatusId: status.id,
    occurredAt: '2026-01-02T03:04:05.000Z',
    taskVersion: 2,
  },
});

export function CompositionExamples() {
  const [notice, setNotice] = useState('');

  return (
    <Surface.Root component="section" aria-label="Composed workspace panel">
      <Surface.Header>
        <Toolbar.Root>
          <Surface.Title component="h2">Composed workspace panel</Surface.Title>
          <Toolbar.Group>
            <Button onClick={() => setNotice('Selected sample-task')}>Select sample</Button>
          </Toolbar.Group>
        </Toolbar.Root>
        <Surface.Description>
          Slots and callbacks compose this view. No API requests are made.
        </Surface.Description>
      </Surface.Header>
      <Surface.Body>
        <TaskTable
          items={[task]}
          statuses={[status]}
          fields={[]}
          onOpenTask={() => setNotice('Selected sample-task')}
        />
        <ActivityPanel>
          <ActivityTimeline items={[activity]} statuses={[status]} />
        </ActivityPanel>
        <MarkdownContent label="Shared Markdown example">
          {'**Safe Markdown** [Example link](javascript:alert(1)) <script>example()</script>'}
        </MarkdownContent>
      </Surface.Body>
      <Surface.Footer>
        <Typography role="status">{notice || 'Choose a sample action.'}</Typography>
      </Surface.Footer>
    </Surface.Root>
  );
}
