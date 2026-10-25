import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { SelectionInput } from '../src/modules/forms/SelectionInput.js';

import type { SelectionInputProps, SelectionValue } from '../src/modules/forms/selectionTypes.js';
import type { Meta, StoryObj } from '@storybook/react-vite';

function ControlledSelection(props: SelectionInputProps) {
  const [value, setValue] = useState<SelectionValue | readonly SelectionValue[]>(props.value);

  return props.multiple ? (
    <SelectionInput
      {...props}
      multiple
      value={Array.isArray(value) ? value : []}
      onChange={(next) => {
        setValue(next);
        props.onChange(next);
      }}
    />
  ) : (
    <SelectionInput
      {...props}
      value={Array.isArray(value) ? null : (value as SelectionValue)}
      onChange={(next) => {
        setValue(next);
        props.onChange(next);
      }}
    />
  );
}

const meta = {
  title: 'Forms/Selection',
  component: SelectionInput,
  args: {
    label: 'Assignees',
    multiple: true,
    value: [],
    onChange: fn(),
    options: [
      { label: 'Alice', value: 'alice' },
      { label: 'Bob', value: 'bob' },
      { label: 'Carol', value: 'carol' },
    ],
  },
  render: (args) => <ControlledSelection {...args} />,
} satisfies Meta<typeof SelectionInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SearchableAssignees: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('combobox', { name: 'Assignees' });
    await userEvent.type(input, 'ali');
    await userEvent.click(
      within(canvasElement.ownerDocument.body).getByRole('option', { name: 'Alice' }),
    );
    await expect(canvas.getByText('Alice')).toBeVisible();
    await userEvent.type(input, 'bob');
    await userEvent.click(
      within(canvasElement.ownerDocument.body).getByRole('option', { name: 'Bob' }),
    );
    await expect(canvas.getByText('Bob')).toBeVisible();
    await userEvent.click(input);
    await userEvent.keyboard('{Backspace}');
    await expect(canvas.queryByText('Bob')).not.toBeInTheDocument();
    await expect(canvas.getByText('Alice')).toBeVisible();
  },
};

export const UnavailableMember: Story = {
  args: { value: ['former-member'] },
};

export const Disabled: Story = {
  args: { disabled: true, value: ['alice'] },
};
