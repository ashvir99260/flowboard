import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, useState } from 'react';

import * as UI from '../dist/index.js';

afterEach(cleanup);

function Selection({ initial = null, onChange = () => {}, ...props }) {
  const [value, setValue] = useState(initial);

  return createElement(UI.SelectionInput, {
    ...props,
    value,
    onChange(next) {
      setValue(next);
      onChange(next);
    },
  });
}

const options = [
  { label: 'None', value: null },
  { label: 'False', value: false },
  { label: 'Zero', value: 0 },
  { label: 'Empty', value: '' },
  { label: 'Same label', value: 'first' },
  { label: 'Same label', value: 'second' },
];

test('selection searches by label and preserves null, false, zero and duplicate labels', () => {
  assert.ok(UI.SelectionInput, 'SelectionInput must be publicly exported');
  const changes = [];
  render(
    createElement(Selection, {
      label: 'Choice',
      options,
      onChange: (value) => changes.push(value),
    }),
  );
  const input = screen.getByRole('combobox', { name: 'Choice' });
  assert.equal(input.value, 'None');
  fireEvent.focus(input);
  for (const [label, expected] of [
    ['False', false],
    ['Zero', 0],
    ['Empty', ''],
    ['None', null],
  ]) {
    fireEvent.change(input, { target: { value: label } });
    fireEvent.click(screen.getByRole('option', { name: label }));
    assert.equal(changes.at(-1), expected);
  }
  fireEvent.change(input, { target: { value: 'Same' } });
  const repeated = screen.getAllByRole('option', { name: 'Same label' });
  assert.equal(repeated.length, 2);
  fireEvent.click(repeated[1]);
  assert.equal(changes.at(-1), 'second');
  fireEvent.change(input, { target: { value: 'not a choice' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.blur(input);
  assert.equal(changes.at(-1), 'second', 'search text never becomes a domain value');
});

test('multiple selection retains unavailable choices and supports keyboard chip removal', () => {
  const changes = [];
  let control;
  render(
    createElement(Selection, {
      label: 'Members',
      multiple: true,
      options,
      initial: [false, 0, 'removed'],
      inputRef: (element) => {
        control = element;
      },
      onChange: (value) => changes.push(value),
    }),
  );
  const input = screen.getByRole('combobox', { name: 'Members' });
  assert.equal(control, input);
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  assert.ok(screen.getByText('Selected option is no longer available'));
  assert.ok(screen.getByText('Unavailable option (removed)'));
  fireEvent.keyDown(input, { key: 'Backspace' });
  assert.deepEqual(changes.at(-1), [false, 0]);
  assert.equal(input.getAttribute('aria-invalid'), 'false');
  fireEvent.change(input, { target: { value: 'Same' } });
  fireEvent.click(screen.getAllByRole('option', { name: 'Same label' })[0]);
  assert.deepEqual(changes.at(-1), [false, 0, 'first']);
});

test('disabled choices and linked errors retain input focus and blur semantics', () => {
  let blurred = 0;
  const changes = [];
  render(
    createElement(Selection, {
      label: 'Choice',
      name: 'choice',
      required: true,
      error: 'Choose a permitted value',
      options: [
        { disabled: true, label: 'Blocked', value: 'blocked' },
        { label: 'Allowed', value: 'allowed' },
      ],
      onBlur: () => {
        blurred += 1;
      },
      onChange: (value) => changes.push(value),
    }),
  );
  const input = screen.getByRole('combobox', { name: /Choice/ });
  assert.equal(input.name, 'choice');
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  assert.equal(
    globalThis.document.getElementById(input.getAttribute('aria-describedby')).textContent,
    'Choose a permitted value',
  );
  fireEvent.change(input, { target: { value: 'Blocked' } });
  assert.equal(
    screen.getByRole('option', { name: 'Blocked' }).getAttribute('aria-disabled'),
    'true',
  );
  fireEvent.keyDown(input, { key: 'Enter' });
  assert.deepEqual(changes, []);
  fireEvent.blur(input);
  assert.equal(blurred, 1);
});

test('multiple null remains a selected unavailable value; disabling retains the selection', () => {
  const changes = [];
  const view = render(
    createElement(Selection, {
      label: 'Choice',
      multiple: true,
      options: [],
      initial: [null],
      onChange: (value) => changes.push(value),
    }),
  );
  const input = screen.getByRole('combobox', { name: 'Choice' });
  assert.ok(screen.getByText('Unavailable option (null)'));
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  view.rerender(
    createElement(Selection, {
      label: 'Choice',
      multiple: true,
      disabled: true,
      options: [],
      initial: [null],
      onChange: (value) => changes.push(value),
    }),
  );
  assert.equal(input.disabled, true);
  assert.ok(screen.getByText('Unavailable option (null)'));
  assert.deepEqual(changes, []);
});

test('required multi-selection uses the selected values for native required validity', () => {
  render(
    createElement(Selection, {
      label: 'Choice',
      required: true,
      multiple: true,
      options,
      initial: [false],
    }),
  );
  const input = screen.getByRole('combobox', { name: 'Choice' });
  assert.equal(input.required, false);
  assert.equal(input.getAttribute('aria-required'), 'true');
  fireEvent.keyDown(input, { key: 'Backspace' });
  assert.equal(input.required, true);
});

test('a nullable multi-select can distinguish clearing from removing its final chip', () => {
  const changes = [];
  render(
    createElement(UI.CustomFieldInput, {
      field: {
        key: 'tags',
        name: 'Tags',
        type: 'multi_select',
        required: false,
        options: [{ id: 'a', label: 'Alpha' }],
      },
      value: ['a'],
      onChange: (value) => changes.push(value),
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clear Tags' }));
  assert.equal(changes.at(-1), null);
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Tags' }), { key: 'Backspace' });
  assert.deepEqual(changes.at(-1), []);
});

test('unrelated renders with equivalent options preserve the active search text', () => {
  const priorityOptions = [
    { label: 'normal', value: 'normal' },
    { label: 'high', value: 'high' },
  ];
  const view = render(
    createElement(Selection, { label: 'Priority', options: priorityOptions, initial: 'normal' }),
  );
  const input = screen.getByRole('combobox', { name: 'Priority' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'high' } });
  view.rerender(
    createElement(Selection, {
      label: 'Priority',
      options: priorityOptions.map((option) => ({ ...option })),
      initial: 'normal',
    }),
  );
  assert.equal(input.value, 'high');
  assert.ok(screen.getByRole('option', { name: 'high' }));
  fireEvent.click(screen.getByRole('option', { name: 'high' }));
  assert.equal(input.value, 'high');
});

test('multiple selection preserves typed search across equivalent value and option arrays', () => {
  const memberOptions = [
    { label: 'Alice', value: 'alice' },
    { label: 'Bob', value: 'bob' },
  ];
  const view = render(
    createElement(UI.SelectionInput, {
      label: 'Members',
      multiple: true,
      value: ['alice'],
      options: memberOptions,
      onChange: () => {},
    }),
  );
  const input = screen.getByRole('combobox', { name: 'Members' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'Bob' } });
  view.rerender(
    createElement(UI.SelectionInput, {
      label: 'Members',
      multiple: true,
      value: ['alice'],
      options: memberOptions.map((option) => ({ ...option })),
      onChange: () => {},
    }),
  );
  assert.equal(input.value, 'Bob');
  assert.ok(screen.getByRole('option', { name: 'Bob' }));
  assert.ok(screen.getByText('Alice'));
});

test('async selected labels refresh without overwriting a focused search', () => {
  const initialOptions = [
    { label: 'Loading selected parent', value: 'selected' },
    { label: 'Other task', value: 'other' },
  ];
  const view = render(
    createElement(Selection, { label: 'Parent', options: initialOptions, initial: 'selected' }),
  );
  const input = screen.getByRole('combobox', { name: 'Parent' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'Other' } });
  view.rerender(
    createElement(Selection, {
      label: 'Parent',
      options: [
        { label: 'Resolved parent', value: 'selected' },
        { label: 'Other task', value: 'other' },
      ],
      initial: 'selected',
    }),
  );
  assert.equal(input.value, 'Other');
  fireEvent.blur(input);
  assert.equal(input.value, 'Resolved parent');
});

test('selected labels and removed options refresh when there is no active search', () => {
  const changes = [];
  const props = {
    label: 'Parent',
    value: 'selected',
    onChange: (value) => changes.push(value),
  };
  const view = render(
    createElement(UI.SelectionInput, {
      ...props,
      options: [{ label: 'Loading selected parent', value: 'selected' }],
    }),
  );
  const input = screen.getByRole('combobox', { name: 'Parent' });
  view.rerender(
    createElement(UI.SelectionInput, {
      ...props,
      options: [{ label: 'Resolved parent', value: 'selected' }],
    }),
  );
  assert.equal(input.value, 'Resolved parent');
  view.rerender(createElement(UI.SelectionInput, { ...props, options: [] }));
  assert.equal(input.value, 'Unavailable option (selected)');
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  assert.deepEqual(changes, []);
});
