import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { CustomFieldInput } from '../src/components/custom-field-input.js';
import { Stack, Typography } from '../src/primitives.js';

import { approved, area, effort } from './fixtures.js';

import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';

function ControlledField(args: ComponentProps<typeof CustomFieldInput>) {
  const [value, setValue] = useState(args.value);

  return (
    <Stack spacing={1.2}>
      <CustomFieldInput
        {...args}
        value={value}
        onChange={(next) => {
          setValue(next);
          args.onChange(next);
        }}
      />
      <Typography aria-label="Current value" component="output">
        {JSON.stringify(value)}
      </Typography>
    </Stack>
  );
}

const meta = {
  title: 'Forms/Custom field',
  component: CustomFieldInput,
  args: { field: effort, value: 0, onChange: fn() },
  render: (args) => (
    <ControlledField
      key={`${args.field.key}:${args.field.type}:${JSON.stringify(args.value)}`}
      {...args}
    />
  ),
} satisfies Meta<typeof CustomFieldInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NumberDraft: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Effort' });
    await userEvent.clear(input);
    await userEvent.type(input, '-');
    await expect(input).toHaveValue('-');
    await userEvent.clear(input);
    await userEvent.type(input, '1e3');
    await userEvent.tab();
    await expect(input).toHaveValue('1000');
    await userEvent.clear(input);
    await expect(canvas.getByLabelText('Current value')).toHaveTextContent('null');
  },
};

export const RequiredFalse: Story = {
  args: { field: approved, value: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole('checkbox', { name: /Approved/ });
    await expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    await expect(canvas.getByLabelText('Current value')).toHaveTextContent('false');
  },
};

export const Select: Story = { args: { field: area, value: area.options[0]!.id } };

export const UnavailableOption: Story = {
  args: { field: area, value: 'removed', error: 'Choose an available option.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole('combobox', { name: 'Area' });
    await expect(select).toHaveValue('removed');
    await userEvent.selectOptions(select, area.options[0]!.id);
    await expect(select).toHaveValue(area.options[0]!.id);
  },
};

export const Text: Story = {
  args: { field: { ...effort, key: 'summary', name: 'Summary', type: 'text' }, value: '' },
};

export const Date: Story = {
  args: {
    field: { ...effort, key: 'review_date', name: 'Review date', type: 'date' },
    value: '2026-12-01',
  },
};

export const MultiSelect: Story = {
  args: {
    field: { ...area, type: 'multi_select' },
    value: area.options.map((option) => option.id),
  },
};
