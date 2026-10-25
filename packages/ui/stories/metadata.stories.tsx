import { AssigneeAvatarGroup } from '../src/components/assignee-avatar-group.js';
import { CustomFieldChip } from '../src/components/custom-field-chip.js';
import { DueDateLabel } from '../src/components/due-date-label.js';
import { PriorityBadge } from '../src/components/priority-badge.js';
import { StatusChip } from '../src/components/status-chip.js';
import { Stack, Typography } from '../src/primitives.js';

import { approved, effort, statuses } from './fixtures.js';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Data display/Status chip',
  component: StatusChip,
  args: { status: statuses[0]! },
} satisfies Meta<typeof StatusChip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Status: Story = {};

export const Dark: Story = { globals: { theme: 'dark' } };

export const AllMetadata: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack spacing={1.6}>
      <Typography component="h1" variant="h2">
        Task metadata
      </Typography>
      <Stack direction="row" spacing={0.8} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {statuses.map((status) => (
          <StatusChip key={status.id} status={status} />
        ))}
      </Stack>
      <Stack direction="row" spacing={0.8} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {(['urgent', 'high', 'normal', 'low', 'none'] as const).map((priority) => (
          <PriorityBadge key={priority} priority={priority} />
        ))}
      </Stack>
      <AssigneeAvatarGroup
        assignees={[
          { id: 'alice', name: 'Alice' },
          { id: 'bob', name: 'Bob' },
          { id: 'carol', name: 'Carol' },
          { id: 'dana', name: 'Dana' },
        ]}
      />
      <AssigneeAvatarGroup assignees={[]} />
      <DueDateLabel date="2026-12-01" />
      <DueDateLabel date={null} />
      <CustomFieldChip field={effort} value={0} />
      <CustomFieldChip field={approved} value={false} />
    </Stack>
  ),
};
