import { expect, fn, userEvent, within } from 'storybook/test';

import { FormField } from '../src/components/form-field.js';
import { Surface, Toolbar } from '../src/composition.js';
import { Button, Stack } from '../src/primitives.js';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Foundations/Button',
  component: Button,
  args: { children: 'Save changes', onClick: fn(), variant: 'contained' },
  argTypes: {
    variant: { control: 'select', options: ['text', 'outlined', 'contained'] },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Save changes' }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Disabled: Story = { args: { disabled: true } };

export const ComposedSurface: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Surface.Root>
      <Surface.Header>
        <Surface.Title component="h1">Task settings</Surface.Title>
        <Surface.Description>Reusable slots with caller-owned content.</Surface.Description>
      </Surface.Header>
      <Surface.Body>
        <Stack spacing={1.6}>
          <FormField
            defaultValue="Review component states"
            hint="Keep the title descriptive."
            label="Title"
          />
          <FormField label="Required name" value="" errorMessage="Enter a name." onChange={fn()} />
        </Stack>
      </Surface.Body>
      <Surface.Footer>
        <Toolbar.Root>
          <Button variant="outlined">Cancel</Button>
          <Button variant="contained">Save</Button>
        </Toolbar.Root>
      </Surface.Footer>
    </Surface.Root>
  ),
};
