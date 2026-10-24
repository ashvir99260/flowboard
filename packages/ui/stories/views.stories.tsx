import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { EmptyState } from '../src/components/empty-state.js';
import { ErrorState } from '../src/components/error-state.js';
import { FieldPreview } from '../src/components/field-preview.js';
import { LoadingState } from '../src/components/loading-state.js';
import { MarkdownContent } from '../src/components/markdown-content.js';
import { StatusPreview } from '../src/components/status-preview.js';
import { TaskTable } from '../src/components/task-table.js';
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
    await expect(canvas.getByRole('columnheader', { name: /Effort/ })).toBeVisible();
    await expect(canvas.getByText('Approved: No')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: `Open task: ${task.title}` }));
    await expect(args.onOpenTask).toHaveBeenCalledWith(task.id);
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
