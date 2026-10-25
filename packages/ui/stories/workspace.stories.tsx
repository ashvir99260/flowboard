import { default as Box } from '@mui/material/Box';
import { default as IconButton } from '@mui/material/IconButton';
import { default as Stack } from '@mui/material/Stack';
import { default as Typography } from '@mui/material/Typography';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { BoardGrid } from '../src/modules/board/BoardGrid.js';
import { BoardViewport } from '../src/modules/board/BoardViewport.js';
import { KanbanCard } from '../src/modules/board/KanbanCard.js';
import { WorkspaceColumn } from '../src/modules/board/WorkspaceColumn.js';
import { FlowboardLogo } from '../src/modules/layout/FlowboardLogo.js';
import { WorkspaceLayout } from '../src/modules/layout/WorkspaceLayout.js';
import { TreeItem } from '../src/modules/navigation/TreeItem.js';
import { WorkspaceIcon } from '../src/modules/navigation/WorkspaceIcon.js';
import { Button } from '../src/modules/primitives/Button.js';

import { task } from './fixtures.js';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Workspace/Application frame',
  component: WorkspaceLayout,
  parameters: { layout: 'fullscreen', controls: { disable: true } },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  args: { onClose: fn(), onOpen: fn(), open: false, navigation: null, children: null },
} satisfies Meta<typeof WorkspaceLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

function WorkspaceDemo() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [selected, setSelected] = useState('Workspace board');

  const select = (name: string) => {
    setSelected(name);
    setOpen(false);
  };

  return (
    <WorkspaceLayout
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      header={<FlowboardLogo />}
      headerActions={
        <>
          <Button variant="contained" startIcon={<WorkspaceIcon name="plus" />}>
            New task
          </Button>
          <IconButton aria-label="Invite members">
            <WorkspaceIcon name="people" />
          </IconButton>
          <IconButton aria-label="Workspace settings">
            <WorkspaceIcon name="settings" />
          </IconButton>
        </>
      }
      navigation={
        <Stack spacing={2.4}>
          <Button endIcon={<WorkspaceIcon name="chevronDown" />} fullWidth>
            Product workspace
          </Button>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            <TreeItem
              type="workspace"
              name="Workspace board"
              selected={selected === 'Workspace board'}
              onSelect={() => select('Workspace board')}
            />
            <TreeItem
              type="space"
              name="Product"
              expanded={expanded}
              onToggle={() => setExpanded(!expanded)}
              onSelect={() => select('Product')}
              selected={selected === 'Product'}
            >
              <TreeItem
                type="list"
                name="Roadmap"
                selected={selected === 'Roadmap'}
                onSelect={() => select('Roadmap')}
              />
              <TreeItem
                type="list"
                name="Discovery"
                selected={selected === 'Discovery'}
                onSelect={() => select('Discovery')}
              />
            </TreeItem>
          </Box>
        </Stack>
      }
    >
      <Stack spacing={2.4}>
        <Box>
          <Typography color="text.secondary" variant="body2">
            Product workspace
          </Typography>
          <Typography component="h1" variant="h1">
            {selected}
          </Typography>
        </Box>
        <BoardViewport>
          <BoardGrid>
            <WorkspaceColumn
              name="Roadmap"
              count={1}
              actions={
                <IconButton aria-label="Roadmap actions">
                  <WorkspaceIcon name="dots" />
                </IconButton>
              }
            >
              <KanbanCard
                task={task}
                onOpen={fn()}
                metadata={
                  <Typography color="text.secondary" variant="body2">
                    Platform
                  </Typography>
                }
              />
            </WorkspaceColumn>
            <WorkspaceColumn
              name="Discovery"
              count={0}
              actions={
                <IconButton aria-label="Discovery actions">
                  <WorkspaceIcon name="dots" />
                </IconButton>
              }
            >
              <Button startIcon={<WorkspaceIcon name="plus" />}>Add task</Button>
            </WorkspaceColumn>
          </BoardGrid>
        </BoardViewport>
      </Stack>
    </WorkspaceLayout>
  );
}

export const Desktop: Story = {
  render: () => <WorkspaceDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('banner')).toBeVisible();
    await expect(canvas.getByRole('img', { name: 'Flowboard' })).toBeVisible();
    const roadmap = canvas.getByRole('button', { name: 'Roadmap' });
    roadmap.focus();
    await userEvent.keyboard('{Enter}');
    await expect(roadmap).toHaveAttribute('aria-current', 'page');
    await expect(canvas.getByRole('heading', { name: 'Roadmap', level: 1 })).toBeVisible();
  },
};

export const Dark: Story = {
  render: () => <WorkspaceDemo />,
  globals: { theme: 'dark' },
};

export const Narrow: Story = {
  render: () => <WorkspaceDemo />,
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole('button', { name: 'Open navigation' }));
    await expect(page.getByRole('navigation', { name: 'Workspace navigation' })).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Roadmap' }));
    await waitFor(() =>
      expect(
        page.queryByRole('navigation', { name: 'Workspace navigation' }),
      ).not.toBeInTheDocument(),
    );
    await expect(page.getByRole('heading', { name: 'Roadmap', level: 1 })).toBeVisible();
  },
};
