import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, useState } from 'react';

import * as UI from '../dist/index.js';

afterEach(cleanup);

function Input({ field, initial = null, onChange = () => {} }) {
  const [value, setValue] = useState(initial);

  return createElement(UI.CustomFieldInput, {
    field,
    value,
    onChange(next) {
      setValue(next);
      onChange(next);
    },
  });
}
const definition = (type) => ({ key: 'value', name: 'Value', type, required: true, options: [] });

test('number drafts preserve zero, explicit clearing and invalid intermediate text', () => {
  const values = [];
  render(
    createElement(Input, {
      field: definition('number'),
      initial: 0,
      onChange: (value) => values.push(value),
    }),
  );
  const input = screen.getByLabelText('Value', { exact: false });
  assert.equal(input.value, '0');
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.change(input, { target: { value: '-' } });
  assert.equal(input.value, '-');
  fireEvent.change(input, { target: { value: '-0.5' } });
  fireEvent.change(input, { target: { value: '1e' } });
  assert.equal(input.value, '1e');
  fireEvent.change(input, { target: { value: '1e3' } });
  assert.deepEqual(values, [null, '-', -0.5, '1e', 1000]);
});

test('text and dates clear explicitly; required checkboxes preserve false', () => {
  for (const [type, initial, changed] of [
    ['text', 'Original', 'Changed'],
    ['date', '2024-02-29', '2024-03-01'],
  ]) {
    const values = [];
    render(
      createElement(Input, {
        field: definition(type),
        initial,
        onChange: (value) => values.push(value),
      }),
    );
    const input = screen.getByLabelText('Value', { exact: false });
    fireEvent.change(input, { target: { value: changed } });
    fireEvent.change(input, { target: { value: '' } });
    assert.deepEqual(values, [changed, null]);
    cleanup();
  }
  const values = [];
  render(
    createElement(Input, {
      field: definition('checkbox'),
      initial: false,
      onChange: (value) => values.push(value),
    }),
  );
  const input = screen.getByRole('checkbox', { exact: false, name: 'Value' });
  assert.equal(input.checked, false);
  assert.equal(input.required, false, 'Required boolean means a supplied boolean, not forced true');
  fireEvent.click(input);
  fireEvent.click(input);
  assert.deepEqual(values, [true, false]);
});

const options = [
  { color: '#245CC5', id: 'a', label: 'Design' },
  { color: '#146C43', id: 'b', label: 'Platform' },
];
test('select controls use IDs and retain removed values for correction', () => {
  const values = [];
  const field = { ...definition('single_select'), options };
  const view = render(
    createElement(Input, { field, initial: 'a', onChange: (value) => values.push(value) }),
  );
  const input = screen.getByRole('combobox', { exact: false, name: 'Value' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'Platform' } });
  fireEvent.click(screen.getByRole('option', { name: 'Platform' }));
  assert.deepEqual(values, ['b']);
  view.rerender(
    createElement(Input, {
      field: { ...field, options: [options[0]] },
      onChange: (value) => values.push(value),
    }),
  );
  assert.equal(input.value, 'Unavailable option (b)');
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  fireEvent.change(input, { target: { value: '' } });
  assert.equal(values.at(-1), null);
  cleanup();
  render(
    createElement(Input, {
      field: { ...field, type: 'multi_select' },
      initial: ['b'],
      onChange: (value) => values.push(value),
    }),
  );
  const multiple = screen.getByRole('combobox', { exact: false, name: 'Value' });
  assert.ok(screen.getByText('Platform'));
  fireEvent.keyDown(multiple, { key: 'Backspace' });
  assert.deepEqual(values.at(-1), []);
  fireEvent.change(multiple, { target: { value: 'Design' } });
  fireEvent.click(screen.getByRole('option', { name: 'Design' }));
  assert.deepEqual(values.at(-1), ['a']);
});

test('field errors remain linked to their labeled controls', () => {
  render(
    createElement(UI.CustomFieldInput, {
      field: definition('number'),
      value: '-',
      error: 'Expected a finite number',
      onChange() {},
    }),
  );
  const input = screen.getByLabelText('Value', { exact: false });
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  assert.equal(
    globalThis.document.getElementById(input.getAttribute('aria-describedby')).textContent,
    'Expected a finite number',
  );
});

test(
  'confirmation names its purpose, blocks duplicate actions while busy and restores trigger focus',
  { timeout: 10000 },
  async () => {
    const { waitFor } = await import('@testing-library/react');
    let confirmed = 0;
    function Confirmation() {
      const [open, setOpen] = useState(false);
      const [busy, setBusy] = useState(false);

      return createElement(
        'div',
        {},
        createElement('button', { onClick: () => setOpen(true) }, 'Archive task'),
        createElement(UI.ConfirmDialog, {
          open,
          busy,
          title: 'Archive this task?',
          description: 'You can restore it later.',
          confirmLabel: 'Archive',
          onCancel: () => setOpen(false),
          onConfirm() {
            confirmed += 1;
            setBusy(true);
          },
        }),
        createElement(
          'button',
          {
            onClick: () => {
              setBusy(false);
              setOpen(false);
            },
          },
          'Complete request',
        ),
      );
    }
    render(createElement(Confirmation));
    const trigger = screen.getByRole('button', { name: 'Archive task' });
    trigger.focus();
    fireEvent.click(trigger);
    assert.ok(screen.getByRole('dialog', { name: 'Archive this task?' }));
    await waitFor(() =>
      assert.ok(
        globalThis.document.activeElement === screen.getByRole('button', { name: 'Cancel' }),
      ),
    );
    fireEvent.keyDown(globalThis.document.activeElement, { key: 'Escape' });
    await waitFor(() => assert.ok(!screen.queryByRole('dialog')));
    assert.ok(globalThis.document.activeElement === trigger);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { exact: true, name: 'Archive' }));
    assert.equal(screen.getByRole('button', { exact: true, name: 'Archive' }).disabled, true);
    assert.equal(screen.getByRole('button', { name: 'Cancel' }).disabled, true);
    fireEvent.click(screen.getByRole('button', { exact: true, name: 'Archive' }));
    assert.equal(confirmed, 1);
  },
);

test('raw number keystrokes retain zeros and exponents until blur', () => {
  const values = [];
  render(
    createElement(Input, { field: definition('number'), onChange: (value) => values.push(value) }),
  );
  const input = screen.getByLabelText('Value', { exact: false });
  for (const value of ['0', '0.', '0.0']) fireEvent.change(input, { target: { value } });
  assert.equal(input.value, '0.0');
  fireEvent.change(input, { target: { value: `${input.value}5` } });
  assert.equal(values.at(-1), 0.05);
  for (const value of ['1', '1e', '1e1']) fireEvent.change(input, { target: { value } });
  assert.equal(input.value, '1e1');
  fireEvent.change(input, { target: { value: `${input.value}2` } });
  assert.equal(values.at(-1), 1e12);
});

test('optional checkbox can clear and every field exposes a focusable control', () => {
  const values = [];
  render(
    createElement(Input, {
      field: { ...definition('checkbox'), required: false },
      initial: false,
      onChange: (value) => values.push(value),
    }),
  );
  const clear = screen.getByRole('button', { name: 'Clear Value' });
  clear.focus();
  fireEvent.click(clear);
  assert.ok(globalThis.document.activeElement === screen.getByRole('checkbox', { name: 'Value' }));
  assert.equal(values.at(-1), null);
  cleanup();
  for (const type of ['text', 'number', 'date', 'checkbox', 'single_select', 'multi_select']) {
    let control;
    render(
      createElement(UI.CustomFieldInput, {
        field: { ...definition(type), options: type.includes('select') ? options : [] },
        value: null,
        onChange() {},
        inputRef(element) {
          control = element;
        },
      }),
    );
    control.focus();
    assert.equal(
      globalThis.document.activeElement,
      control,
      `${type} must forward the actual input`,
    );
    cleanup();
  }
});

test('tree separates selection from expansion and hides collapsed descendants', () => {
  let selected = 0;
  function Tree() {
    const [expanded, setExpanded] = useState(false);

    return createElement(
      'ul',
      {},
      createElement(
        UI.TreeItem,
        {
          name: 'Product',
          type: 'space',
          expanded,
          selected: true,
          onSelect: () => {
            selected += 1;
          },
          onToggle: () => setExpanded(!expanded),
        },
        createElement(UI.TreeItem, {
          name: 'Backlog',
          type: 'list',
          onSelect: () => {
            selected += 1;
          },
        }),
      ),
    );
  }
  render(createElement(Tree));
  assert.equal(screen.queryByRole('button', { exact: true, name: 'Backlog' }), null);
  fireEvent.click(screen.getByRole('button', { name: 'Expand Product' }));
  assert.equal(selected, 0);
  assert.ok(screen.getByRole('button', { exact: true, name: 'Backlog' }));
  const parent = screen.getByRole('button', { exact: true, name: 'Product' });
  assert.equal(parent.getAttribute('aria-current'), 'page');
  fireEvent.click(parent);
  assert.equal(selected, 1);
  fireEvent.click(screen.getByRole('button', { name: 'Collapse Product' }));
  assert.equal(screen.queryByRole('button', { exact: true, name: 'Backlog' }), null);
});

test('board primitives expose status and task metadata without nesting action buttons', () => {
  let opened = 0;
  let moved = 0;
  let added = 0;
  render(
    createElement(
      UI.KanbanColumn,
      {
        status: { category: 'active', color: '#245CC5', name: 'Doing' },
        count: 1,
        action: createElement(
          'button',
          {
            onClick: () => {
              added += 1;
            },
          },
          'Add task',
        ),
      },
      createElement(UI.KanbanCard, {
        task: {
          id: 'task',
          title: 'A long title to review',
          priority: 'high',
          dueDate: null,
          assignees: [],
        },
        onOpen: () => {
          opened += 1;
        },
        actions: createElement(
          'button',
          {
            onClick: () => {
              moved += 1;
            },
          },
          'Move task',
        ),
        metadata: createElement('span', {}, 'Team: Platform'),
      }),
    ),
  );
  assert.ok(screen.getByRole('region', { name: 'Doing column' }));
  assert.ok(screen.getByText('1 loaded task'));
  assert.ok(screen.getByText('High'));
  assert.ok(screen.getByText('Team: Platform'));
  fireEvent.click(screen.getByRole('button', { name: 'Move task' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
  assert.deepEqual([opened, moved, added], [0, 1, 1]);
  fireEvent.click(screen.getByRole('button', { name: 'Open task: A long title to review' }));
  assert.equal(opened, 1);
  fireEvent.click(screen.getByRole('article', { name: 'A long title to review' }));
  assert.equal(opened, 2, 'card body opens task details');
  fireEvent.click(screen.getByText('Team: Platform'));
  assert.equal(opened, 3, 'non-interactive metadata opens task details');
  const prevented = new globalThis.window.MouseEvent('click', { bubbles: true, cancelable: true });
  prevented.preventDefault();
  fireEvent(screen.getByRole('article'), prevented);
  assert.equal(opened, 3, 'a suppressed drag click does not open task details');
  assert.equal(globalThis.document.querySelector('button button'), null);
});

test('a read-only board card exposes a heading without an inactive title button', () => {
  render(
    createElement(UI.KanbanCard, {
      task: {
        id: 'read-only',
        title: 'Read-only task',
        priority: 'none',
        dueDate: null,
        assignees: [],
      },
    }),
  );
  assert.ok(screen.getByRole('heading', { level: 3, name: 'Read-only task' }));
  assert.equal(screen.queryByRole('button', { name: 'Read-only task' }), null);
});

test('compact board cards keep title, drag and move controls independent', () => {
  const calls = [];
  const title = 'Review a long task title that must retain its complete accessible name';
  render(
    createElement(UI.KanbanCard, {
      task: {
        id: 'compact',
        title,
        priority: 'high',
        dueDate: '2024-03-01T00:20:30.123Z',
        assignees: [],
      },
      onOpen: () => calls.push('open'),
      dragHandle: createElement(
        'button',
        { 'aria-label': 'Drag task', onClick: () => calls.push('drag') },
        'Drag',
      ),
      actions: createElement('button', { onClick: () => calls.push('move') }, 'Move task'),
    }),
  );
  const open = screen.getByRole('button', { name: `Open task: ${title}` });
  const heading = screen.getByRole('heading', { name: title, level: 3 });
  const drag = screen.getByRole('button', { name: 'Drag task' });
  assert.ok(heading.contains(open));
  assert.equal(heading.parentElement, drag.parentElement.parentElement);
  assert.equal(open.getAttribute('title'), title);
  assert.equal(open.getAttribute('data-open-task'), 'compact');
  assert.equal(globalThis.document.querySelector('button button'), null);
  assert.ok(screen.getByText('Mar 1'));
  fireEvent.click(drag);
  fireEvent.click(screen.getByRole('button', { name: 'Move task' }));
  assert.deepEqual(calls, ['drag', 'move']);
  fireEvent.click(open);
  assert.deepEqual(calls, ['drag', 'move', 'open']);
});
