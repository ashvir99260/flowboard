import { expect, fn, userEvent, within } from 'storybook/test';

import { MemberAccess } from '../src/modules/administration/MemberAccess.js';

import type { Meta, StoryObj } from '@storybook/react-vite';

const members = Array.from({ length: 23 }, (_, index) => ({
  userId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  name: `Member ${index + 1}`,
  role: index === 0 ? ('admin' as const) : ('member' as const),
  createdAt: '2026-10-25T00:00:00.000Z',
  updatedAt: '2026-10-25T00:00:00.000Z',
}));

const meta = {
  title: 'Administration/Member access',
  component: MemberAccess,
  args: { members, grants: [], busy: false, onEdit: fn() },
} satisfies Meta<typeof MemberAccess>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PagedRoster: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Previous members' })).toBeDisabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Next members' }));
    await expect(canvas.getByText('Members 21–23 of 23')).toBeVisible();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Edit access for Member 23', exact: true }),
    );
    await expect(args.onEdit).toHaveBeenCalledWith(members[22]!.userId);
  },
};

export const Saving: Story = { args: { busy: true } };
