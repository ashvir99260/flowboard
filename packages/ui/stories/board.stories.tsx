import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { BoardGrid, BoardViewport } from '../src/modules/board/boardLayout.js';
import { KanbanCard } from '../src/modules/board/kanbanCard.js';
import { KanbanColumn } from '../src/modules/board/kanbanColumn.js';
import { TreeItem } from '../src/modules/navigation/treeItem.js';
import { Button, Stack } from '../src/primitives.js';

import { statuses, task } from './fixtures.js';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Navigation and board/Card',
  component: KanbanCard,
  args: { task, onOpen: fn() },
} satisfies Meta<typeof KanbanCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Card: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: task.title }));
    await expect(args.onOpen).toHaveBeenCalledOnce();
  },
};

export const Columns: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <BoardViewport>
      <BoardGrid>
        {statuses.map((status, index) => (
          <KanbanColumn
            key={status.id}
            status={status}
            count={index === 0 ? 1 : 0}
            action={<Button aria-label={`Add task in ${status.name}`}>Add</Button>}
          >
            {index === 0 && <KanbanCard task={task} onOpen={fn()} />}
          </KanbanColumn>
        ))}
      </BoardGrid>
    </BoardViewport>
  ),
};

function Navigation() {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState('');

  return (
    <Stack component="nav" aria-label="Workspace navigation">
      <ul>
        <TreeItem
          type="space"
          name="Product"
          expanded={expanded}
          selected={selected === 'Product'}
          onToggle={() => setExpanded(!expanded)}
          onSelect={() => setSelected('Product')}
        >
          <TreeItem
            type="list"
            name="Roadmap"
            selected={selected === 'Roadmap'}
            onSelect={() => setSelected('Roadmap')}
          />
        </TreeItem>
      </ul>
    </Stack>
  );
}

export const Sidebar: Story = {
  parameters: { controls: { disable: true } },
  render: () => <Navigation />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Expand Product' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Roadmap' }));
    await expect(canvas.getByRole('button', { name: 'Roadmap' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(canvas.getByRole('button', { name: 'Collapse Product' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  },
};
