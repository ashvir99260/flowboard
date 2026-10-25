import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { DateInput } from '../src/modules/forms/DateInput.js';

import type { DateInputProps } from '../src/modules/forms/DateInput.js';
import type { Meta, StoryObj } from '@storybook/react-vite';

function ControlledDate(args: DateInputProps) {
  const [value, setValue] = useState(args.value);

  return (
    <div>
      <DateInput
        {...args}
        value={value}
        onChange={(next) => {
          setValue(next);
          args.onChange(next);
        }}
      />
      <output aria-label="Current value">{JSON.stringify(value)}</output>
    </div>
  );
}

const meta = {
  title: 'Forms/Date input',
  component: DateInput,
  args: {
    kind: 'date',
    label: 'Review date',
    value: '2024-02-29',
    onChange: fn(),
  },
  render: (args) => <ControlledDate key={`${args.kind}:${args.value}`} {...args} />,
} satisfies Meta<typeof DateInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CalendarDate: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Choose date/ }));
    const calendar = within(canvasElement.ownerDocument.body).getByRole('dialog');
    await userEvent.click(within(calendar).getByRole('gridcell', { name: /^15$/ }));
    await expect(canvas.getByLabelText('Current value')).toHaveTextContent('2024-02-15');
    const month = canvas.getByRole('spinbutton', { name: 'Month' });
    await userEvent.click(month);
    await userEvent.keyboard('{Delete}');
    await expect(canvas.getByLabelText('Current value')).toHaveTextContent('Invalid Date');
    await expect(month).toHaveTextContent('MM');
    await userEvent.click(canvas.getByRole('button', { name: 'Clear Review date' }));
    await expect(canvas.getByLabelText('Current value')).toHaveTextContent('null');
  },
};

export const UtcDateTime: Story = {
  args: {
    kind: 'datetime-local',
    label: 'Due date (UTC)',
    value: '2024-03-10T01:59:58.123',
    hint: 'Dates and times are stored in UTC.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('spinbutton', { name: 'Seconds' }));
    await userEvent.keyboard('{ArrowUp}');
    await expect(canvas.getByLabelText('Current value')).toHaveTextContent(
      '2024-03-10T01:59:59.123',
    );
  },
};

export const RequiredDate: Story = { args: { value: null, required: true } };

export const InvalidDate: Story = {
  args: { value: '2025-02-29', error: 'Choose a real calendar date.' },
};

export const DisabledDate: Story = { args: { disabled: true } };
