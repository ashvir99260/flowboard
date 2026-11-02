import { expect, within } from 'storybook/test';

import { BoardSkeleton } from '../src/modules/feedback/BoardSkeleton.js';
import { NavigationSkeleton } from '../src/modules/feedback/NavigationSkeleton.js';
import { TableSkeleton } from '../src/modules/feedback/TableSkeleton.js';
import { TaskDetailSkeleton } from '../src/modules/feedback/TaskDetailSkeleton.js';
import { WorkspaceSkeleton } from '../src/modules/feedback/WorkspaceSkeleton.js';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Feedback/Loading skeletons',
  component: BoardSkeleton,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof BoardSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Board: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('status')).toHaveLength(1);
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading board…');
  },
};

export const Navigation: Story = { render: () => <NavigationSkeleton /> };

export const Table: Story = { render: () => <TableSkeleton /> };

export const TaskDetail: Story = { render: () => <TaskDetailSkeleton /> };

export const Workspace: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => <WorkspaceSkeleton />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('status')).toHaveLength(1);
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
};
