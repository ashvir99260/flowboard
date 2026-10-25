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
