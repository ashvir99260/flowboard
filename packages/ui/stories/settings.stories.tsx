import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { SettingsDetailPanel } from '../src/modules/configuration/SettingsDetailPanel.js';
import { SettingsLayout } from '../src/modules/configuration/SettingsLayout.js';
import { SettingsList } from '../src/modules/configuration/SettingsList.js';
import { Toolbar } from '../src/modules/layout/Toolbar.js';
import { ToastHost } from '../src/modules/notifications/ToastHost.js';
import { Button } from '../src/modules/primitives/Button.js';
import { TextField } from '../src/modules/primitives/TextField.js';

import type { ToastMessage } from '../src/modules/notifications/toastTypes.js';
import type { Meta, StoryObj } from '@storybook/react-vite';

function SettingsExample({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <SettingsLayout
      collection={
        <>
          <Toolbar.Root>
            <h2>Custom fields</h2>
            <Button onClick={() => setSelected('New field')}>Add field</Button>
          </Toolbar.Root>
          <SettingsList.Root aria-label="Custom fields">
            {[
              'Effort',
              'Release date',
              'A long field name that wraps within the available column',
            ].map((title) => (
              <SettingsList.Item
                key={title}
                title={title}
                description="Number · Inherited"
                selected={selected === title}
                onClick={() => setSelected(title)}
              />
            ))}
          </SettingsList.Root>
        </>
      }
      detail={
        selected && (
          <SettingsDetailPanel
            title="Field details"
            closeLabel="Close field details"
            onClose={() => {
              onClose();
              setSelected(null);
            }}
          >
            <TextField label="Field name" defaultValue={selected} />
            <Button variant="contained">Save field</Button>
          </SettingsDetailPanel>
        )
      }
    />
  );
}

const meta = {
  title: 'Configuration/Settings panels',
  component: SettingsExample,
  args: { onClose: fn() },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SettingsExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BrowseAndEdit: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('region', { name: 'Field details' })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: /Effort/ }));
    await expect(canvas.getByRole('region', { name: 'Field details' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Close field details' }));
    await expect(args.onClose).toHaveBeenCalledOnce();
    await expect(canvas.queryByRole('region', { name: 'Field details' })).not.toBeInTheDocument();
  },
};

function NotificationExample() {
  const [active, setActive] = useState(true);
  const [message, setMessage] = useState<ToastMessage>();

  return (
    <ToastHost message={message} onDismiss={() => setMessage(undefined)}>
      <Button onClick={() => setActive(false)}>Leave settings</Button>
      <SettingsDetailPanel
        active={active}
        title="Status details"
        closeLabel="Close details"
        onClose={() => setActive(false)}
      >
        <Button
          onClick={() => setMessage({ id: 701, message: 'Status saved.', severity: 'success' })}
        >
          Show notification
        </Button>
      </SettingsDetailPanel>
    </ToastHost>
  );
}

export const InlineNotifications: Story = {
  render: () => <NotificationExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Show notification' }));
    const panel = canvas.getByRole('region', { name: 'Status details' });
    await waitFor(() =>
      expect(
        within(panel).getByRole('status', { name: 'Notification: Status saved.' }),
      ).toBeVisible(),
    );
    await expect(panel.querySelector('.Toastify__toast-container')).toHaveStyle({
      position: 'static',
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Leave settings' }));
    await waitFor(() => expect(within(panel).queryByRole('status')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(canvas.getByRole('status', { name: 'Notification: Status saved.' })).toBeVisible(),
    );
  },
};
