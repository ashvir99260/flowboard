import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { FieldPreview } from '../src/modules/configuration/fieldPreview.js';
import { StatusPreview } from '../src/modules/configuration/statusPreview.js';
import { MarkdownContent } from '../src/modules/content/markdownContent.js';
import { EmptyState } from '../src/modules/feedback/emptyState.js';
import { ErrorState } from '../src/modules/feedback/errorState.js';
import { LoadingState } from '../src/modules/feedback/loadingState.js';
import { TaskTable } from '../src/modules/tasks/taskTable.js';
import { Button, Stack } from '../src/primitives.js';

import { approved, effort, statuses, task } from './fixtures.js';

import type { FieldValue } from '@flowboard/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Composed views/Task table',
  component: TaskTable,
  args: { items: [task], statuses, fields: [effort, approved], onOpenTask: fn() },
} satisfies Meta<typeof TaskTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithCustomColumns: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('grid', { name: 'List tasks' })).toBeVisible();
    await expect(canvas.getByRole('columnheader', { name: /Effort/ })).toBeVisible();
    await expect(canvas.getByText('Approved: No')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: `Open task: ${task.title}` }));
    await expect(args.onOpenTask).toHaveBeenCalledWith(task.id);
  },
};

export const KeyboardOpening: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('columnheader', { name: 'Title' }));
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getByRole('button', { name: `Open task: ${task.title}` })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onOpenTask).toHaveBeenCalledWith(task.id);
  },
};

export const RemScaling: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const document = canvasElement.ownerDocument;
    const root = document.documentElement;
    const original = root.style.fontSize;
    const header = within(canvasElement).getByRole('columnheader', { name: 'Title' });
    const before = header.getBoundingClientRect().width;
    const font = Number.parseFloat(document.defaultView!.getComputedStyle(root).fontSize);
    try {
      root.style.fontSize = `${font * 1.25}px`;
      await waitFor(() =>
        expect(header.getBoundingClientRect().width).toBeCloseTo(before * 1.25, 0),
      );
    } finally {
      root.style.fontSize = original;
    }
  },
};

export const EmptyGrid: Story = { args: { items: [] } };

const loadedTasks = Array.from({ length: 105 }, (_, index) => ({
  ...task,
  id: `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  title: `Task ${String(index + 1).padStart(3, '0')}`,
}));

function LoadedPageDemo({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const [items, setItems] = useState(loadedTasks.slice(0, 55));

  return (
    <Stack spacing={1.2}>
      <Button onClick={() => setItems(loadedTasks)}>Append loaded rows</Button>
      <Button onClick={() => setItems(loadedTasks.slice(0, 2))}>Reset loaded rows</Button>
      <TaskTable
        items={items}
        statuses={statuses}
        fields={[effort, approved]}
        onOpenTask={onOpenTask}
      />
    </Stack>
  );
}

export const MultipleLoadedPages: Story = {
  parameters: { controls: { disable: true } },
  render: (args) => <LoadedPageDemo onOpenTask={args.onOpenTask} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Go to next page' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Append loaded rows' }));
    await expect(canvas.getByRole('button', { name: 'Open task: Task 051' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Go to next page' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Open task: Task 105' }));
    await expect(args.onOpenTask).toHaveBeenCalledWith(loadedTasks[104]!.id);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset loaded rows' }));
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Open task: Task 001' })).toBeVisible(),
    );
    await expect(
      canvas.queryByRole('button', { name: 'Open task: Task 105' }),
    ).not.toBeInTheDocument();
  },
};

export const SmallViewport: Story = {
  globals: { viewport: { value: 'mobile', isRotated: false } },
};

export const FeedbackStates: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack spacing={1.6}>
      <LoadingState>Loading tasks</LoadingState>
      <EmptyState
        title="No tasks yet"
        description="Create the first task in this list."
        action={<Button>Create task</Button>}
      />
      <ErrorState
        title="Tasks unavailable"
        description="Try again when your connection is restored."
        action={<Button>Retry</Button>}
      />
    </Stack>
  ),
};

function ConfigPreview() {
  const [values, setValues] = useState<Record<string, FieldValue | null>>({
    effort: 0,
    approved: false,
  });

  return (
    <Stack spacing={2.4}>
      <StatusPreview items={statuses} />
      <FieldPreview
        items={[effort, approved]}
        values={values}
        onValueChange={(key, value) => setValues((previous) => ({ ...previous, [key]: value }))}
      />
    </Stack>
  );
}

export const ResolvedConfiguration: Story = {
  parameters: { controls: { disable: true } },
  render: () => <ConfigPreview />,
};

export const SafeMarkdown: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <MarkdownContent>
      {
        '## Review notes\n\n- Keyboard access\n- **Readable labels**\n\n<script>alert("ignored")</script>'
      }
    </MarkdownContent>
  ),
};
