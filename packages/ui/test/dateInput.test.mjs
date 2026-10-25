import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, useState } from 'react';

import { DateInput } from '../dist/modules/forms/DateInput.js';
import { parseDateValue, serializeDateValue } from '../dist/utils/dateValue.js';

afterEach(cleanup);

test('date values reject impossible dates and retain UTC calendar days', () => {
  assert.equal(serializeDateValue(parseDateValue('2024-02-29', 'date'), 'date'), '2024-02-29');
  assert.equal(parseDateValue('2025-02-29', 'date').isValid(), false);
  assert.equal(parseDateValue('2024-13-01', 'date').isValid(), false);
  assert.equal(parseDateValue('2024-02', 'date').isValid(), false);
  assert.equal(parseDateValue(null, 'date'), null);
  assert.equal(serializeDateValue(null, 'date'), null);
  assert.equal(serializeDateValue(parseDateValue('invalid', 'date'), 'date'), 'Invalid Date');
});

test('date-time values retain seconds and milliseconds without a timezone shift', () => {
  const initial = '2024-03-10T01:59:58.123';
  const value = parseDateValue(initial, 'datetime-local');
  assert.equal(value.isUTC(), true);
  assert.equal(serializeDateValue(value, 'datetime-local'), initial);
  assert.equal(
    serializeDateValue(value.add(1, 'second'), 'datetime-local'),
    '2024-03-10T01:59:59.123',
  );
  assert.equal(
    serializeDateValue(parseDateValue('2024-11-03T01:30', 'datetime-local'), 'datetime-local'),
    '2024-11-03T01:30:00.000',
  );
  assert.equal(parseDateValue('2024-02-30T09:20:00.001', 'datetime-local').isValid(), false);
  assert.equal(parseDateValue('2024-01-01T25:00', 'datetime-local').isValid(), false);
});

function ControlledDate({ initial = '2024-02-29', onChange, ...props }) {
  const [value, setValue] = useState(initial);

  return createElement(DateInput, {
    kind: 'date',
    label: 'Review date',
    ...props,
    value,
    onChange(next) {
      setValue(next);
      onChange?.(next);
    },
  });
}

test('date picker exposes labeled sections, connected errors, and the focus ref', () => {
  let input;
  render(
    createElement(ControlledDate, {
      name: 'reviewDate',
      error: 'Choose a date',
      required: true,
      inputRef: (element) => {
        input = element;
      },
    }),
  );
  const group = screen.getByRole('group', { name: /Review date/ });
  assert.ok(screen.getByRole('spinbutton', { name: 'Month' }));
  assert.equal(group.getAttribute('aria-invalid'), 'true');
  assert.equal(
    globalThis.document.getElementById(group.getAttribute('aria-describedby')).textContent,
    'Choose a date',
  );
  assert.equal(input.name, 'reviewDate');
  act(() => input.focus());
  assert.ok(group.contains(globalThis.document.activeElement));
});

test('clearing an individual section retains an invalid draft until corrected or fully cleared', () => {
  const values = [];
  render(createElement(ControlledDate, { onChange: (value) => values.push(value) }));
  const month = screen.getByRole('spinbutton', { name: 'Month' });
  act(() => month.focus());
  fireEvent.keyDown(month, { key: 'Delete' });
  assert.equal(values.at(-1), 'Invalid Date');
  assert.ok(screen.getByText('Enter a valid date.'));
  fireEvent.click(screen.getByRole('button', { name: 'Clear Review date' }));
  assert.equal(values.at(-1), null);
});

test('a newly typed partial date is invalid and keeps its sections until explicitly cleared', () => {
  const values = [];
  render(createElement(ControlledDate, { initial: null, onChange: (value) => values.push(value) }));
  const year = screen.getByRole('spinbutton', { name: 'Year' });
  act(() => year.focus());
  year.textContent = '2';
  fireEvent.input(year, { data: '2', inputType: 'insertText' });
  assert.equal(values.at(-1), 'Invalid Date');
  assert.equal(year.getAttribute('aria-valuenow'), '2');
  fireEvent.click(screen.getByRole('button', { name: 'Clear Review date' }));
  assert.equal(values.at(-1), null);
  assert.equal(year.getAttribute('aria-valuenow'), null);
});

test('date-time section changes preserve milliseconds and a disabled picker cannot change', () => {
  const values = [];
  const view = render(
    createElement(ControlledDate, {
      initial: '2024-03-10T01:59:58.123',
      kind: 'datetime-local',
      onChange: (value) => values.push(value),
    }),
  );
  const seconds = screen.getByRole('spinbutton', { name: 'Seconds' });
  act(() => seconds.focus());
  fireEvent.keyDown(seconds, { key: 'ArrowUp' });
  assert.equal(values.at(-1), '2024-03-10T01:59:59.123');
  fireEvent.click(screen.getByRole('button', { name: 'Clear Review date' }));
  assert.equal(values.at(-1), null);
  view.rerender(
    createElement(ControlledDate, {
      initial: '2024-03-10T01:59:58.123',
      kind: 'datetime-local',
      disabled: true,
      onChange: (value) => values.push(value),
    }),
  );
  assert.equal(screen.getByRole('button', { name: /Choose date/ }).disabled, true);
});
