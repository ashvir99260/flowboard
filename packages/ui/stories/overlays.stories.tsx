import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { ToastHost } from '../src/modules/notifications/toastHost.js';
import { ConfirmDialog } from '../src/modules/overlays/confirmDialog.js';
import { DrawerPanel } from '../src/modules/overlays/drawerPanel.js';
import { Button, Stack } from '../src/primitives.js';

import type { ToastMessage } from '../src/modules/notifications/toastTypes.js';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';

function Confirmation(args: ComponentProps<typeof ConfirmDialog>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Archive task</Button>
      <ConfirmDialog
        {...args}
        open={open}
        onCancel={() => {
          args.onCancel();
          setOpen(false);
        }}
        onConfirm={() => {
          args.onConfirm();
          setOpen(false);
        }}
      />
    </>
  );
}

const meta = {
  title: 'Overlays/Confirmation',
  component: ConfirmDialog,
  argTypes: {
    open: {
      control: false,
      description: 'Use the trigger to open this focus-restoration example.',
    },
  },
  args: {
    open: false,
    title: 'Archive this task?',
    description: 'The task will be hidden from this list.',
    confirmLabel: 'Archive',
    busy: false,
    onCancel: fn(),
    onConfirm: fn(),
  },
  render: (args) => <Confirmation {...args} />,
} satisfies Meta<typeof ConfirmDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CancelAndRestoreFocus: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const screen = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: 'Archive task' });
    await userEvent.click(trigger);
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Archive this task?' })).toBeVisible(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(args.onCancel).toHaveBeenCalledOnce();
    await expect(trigger).toHaveFocus();
  },
};

export const Busy: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Archive task' }));
    await expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled();
    await expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  },
};

function NotificationDrawer() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<ToastMessage>();

  return (
    <ToastHost message={message} onDismiss={() => setMessage(undefined)}>
      <Button onClick={() => setOpen(true)}>Open task</Button>
      <DrawerPanel open={open} title="Task details" onClose={() => setOpen(false)}>
        <Stack spacing={1.2}>
          <Button
            onClick={() => setMessage({ id: 1, severity: 'success', message: 'Task saved.' })}
          >
            Save changes
          </Button>
        </Stack>
      </DrawerPanel>
    </ToastHost>
  );
}

export const DrawerNotification: Story = {
  parameters: { controls: { disable: true } },
  render: () => <NotificationDrawer />,
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Open task' }));
    const dialog = await screen.findByRole('dialog', { name: 'Task details' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(
        within(dialog).getByRole('status', { name: 'Notification: Task saved.' }),
      ).toBeVisible(),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Dismiss notification' }));
    await expect(dialog).toBeVisible();
  },
};
