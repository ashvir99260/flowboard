import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, createElement as h, useState } from 'react';

import * as UI from '../dist/index.js';

afterEach(cleanup);
const status = { category: 'active', color: '#245CC5', id: 'active', name: 'In progress' };
const fields = [
  {
    id: 'number',
    key: 'effort',
    name: 'Effort',
    type: 'number',
    required: false,
    options: [],
    isInherited: true,
  },
  {
    id: 'flag',
    key: 'approved',
    name: 'Approved',
    type: 'checkbox',
    required: false,
    options: [],
    isInherited: false,
  },
];

test('shared data grid preserves caller order, zero/false values and task callbacks', async () => {
  const opened = [];
  const tasks = ['Second', 'First'].map((title, index) => ({
    id: String(index),
    title,
    priority: 'none',
    statusId: status.id,
    assignees: [],
    dueDate: null,
    customFields: { approved: false, effort: 0 },
  }));
  render(
    h(UI.TaskTable, {
      items: tasks,
      fields,
      statuses: [status],
      onOpenTask: (id) => opened.push(id),
    }),
  );
  assert.ok(screen.getByRole('region', { name: 'Scrollable task list' }));
  assert.ok(await screen.findByRole('grid', { name: 'List tasks' }));
  assert.deepEqual(
    screen.getAllByRole('rowheader').map((item) => item.textContent),
    ['Second', 'First'],
  );
  assert.equal(screen.getAllByText('Effort: 0').length, 2);
  assert.equal(screen.getAllByText('Approved: No').length, 2);
  fireEvent.click(screen.getByRole('button', { name: 'Open task: First' }));
  assert.deepEqual(opened, ['1']);
});

test('controlled previews retain values and report edits without owning caller state', () => {
  const changes = [];
  const props = {
    items: fields,
    values: { approved: false, effort: 0 },
    onValueChange: (key, value) => changes.push([key, value]),
  };
  const view = render(h(UI.FieldPreview, props));
  assert.equal(screen.getByLabelText('Effort').value, '0');
  assert.equal(screen.getByRole('checkbox', { name: 'Approved' }).checked, false);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Approved' }));
  assert.deepEqual(changes, [['approved', true]]);
  assert.equal(screen.getByRole('checkbox', { name: 'Approved' }).checked, false);
  view.rerender(h(UI.FieldPreview, { ...props, values: { approved: true, effort: 12 } }));
  assert.equal(screen.getByLabelText('Effort').value, '12');
  cleanup();
  render(h(UI.StatusPreview, { items: [status], errors: ['Missing done status'] }));
  assert.ok(screen.getByRole('alert'));
  assert.equal(screen.queryByText('In progress'), null);
});

test('activity slots preserve event order, actor text and occurrence time', () => {
  const items = ['2', '1'].map((id) => ({
    id,
    actor: { name: `<Actor ${id}>` },
    payload: {
      beforeStatusId: 'removed-id',
      afterStatusId: status.id,
      occurredAt: '2026-01-02T03:04:05.000Z',
    },
  }));
  render(
    h(
      UI.ActivityPanel,
      { actions: h('button', {}, 'Refresh entries') },
      h(UI.ActivityTimeline, { items, statuses: [status] }),
    ),
  );
  assert.ok(screen.getByRole('region', { name: 'Activity' }));
  assert.ok(screen.getByRole('button', { name: 'Refresh entries' }));
  assert.match(
    screen.getAllByRole('listitem')[0].textContent,
    /<Actor 2> changed status from Status removed-/,
  );
  assert.equal(globalThis.document.querySelector('time').dateTime, items[0].payload.occurredAt);
  assert.equal(globalThis.document.querySelector('actor'), null);
});

test('Markdown presentation retains formatting while dropping raw HTML and unsafe links', () => {
  render(h(UI.MarkdownContent, {}, '**Bold** [bad](javascript:alert(1)) <script>bad()</script>'));
  assert.ok(screen.getByRole('region', { name: 'Description preview' }));
  assert.equal(globalThis.document.querySelector('strong').textContent, 'Bold');
  assert.equal(globalThis.document.querySelector('script'), null);
  assert.ok(
    !screen.getByText('bad', { selector: 'a' }).getAttribute('href')?.startsWith('javascript:'),
  );
});

test('board layout forwards native refs, drag attributes and positioning styles', () => {
  const ref = createRef();
  render(
    h(
      UI.BoardViewport,
      { 'aria-label': 'Task board', role: 'region', tabIndex: 0 },
      h(
        UI.BoardGrid,
        {},
        h(
          UI.BoardDropzone,
          { 'data-highlighted': true },
          h(
            UI.BoardItem,
            {
              ref,
              'data-rfd-draggable-id': 'task',
              style: { position: 'fixed', transform: 'translate(4px, 8px)' },
            },
            'Card',
          ),
        ),
      ),
    ),
  );
  assert.equal(ref.current.dataset.rfdDraggableId, 'task');
  assert.equal(ref.current.style.transform, 'translate(4px, 8px)');
  assert.equal(ref.current.style.position, 'fixed');
  screen.getByRole('region', { name: 'Task board' }).focus();
  assert.equal(globalThis.document.activeElement.getAttribute('aria-label'), 'Task board');
});

test('controlled drawer retains slots, Escape and trigger focus', async () => {
  function Example() {
    const [open, setOpen] = useState(false);

    return h(
      'div',
      {},
      h('button', { onClick: () => setOpen(true) }, 'Open details'),
      h(
        UI.DrawerPanel,
        { open, title: 'Task details', closeLabel: 'Close task', onClose: () => setOpen(false) },
        h('input', { 'aria-label': 'Draft' }),
      ),
    );
  }
  render(h(Example));
  const trigger = screen.getByRole('button', { name: 'Open details' });
  trigger.focus();
  fireEvent.click(trigger);
  assert.ok(screen.getByRole('dialog', { name: 'Task details' }));
  await waitFor(() =>
    assert.ok(
      globalThis.document.activeElement === screen.getByRole('button', { name: 'Close task' }),
    ),
  );
  fireEvent.keyDown(globalThis.document.activeElement, { key: 'Escape' });
  await waitFor(() => assert.ok(screen.queryByRole('dialog') === null));
  assert.ok(globalThis.document.activeElement === trigger);
});

test('loading and workspace slots have accessible names and controlled navigation', () => {
  const opened = [];
  render(
    h(
      UI.ThemeProvider,
      {},
      h(
        UI.WorkspaceLayout,
        {
          navigation: h('a', { href: '/lists' }, 'My lists'),
          open: false,
          onOpen: () => opened.push(true),
          onClose: () => opened.push(false),
        },
        h(UI.LoadingState, {}, 'Opening board…'),
      ),
    ),
  );
  assert.equal(screen.getByRole('status').textContent, 'Opening board…');
  fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
  assert.deepEqual(opened, [true]);
});

test('a busy drawer blocks Escape and its close action', () => {
  let calls = 0;
  render(
    h(
      UI.DrawerPanel,
      {
        open: true,
        title: 'Saving task',
        closeDisabled: true,
        onClose: () => {
          calls += 1;
        },
      },
      'Saving',
    ),
  );
  const close = screen.getByRole('button', { name: 'Close' });
  assert.equal(close.disabled, true);
  assert.equal(close.textContent, '');
  assert.ok(close.querySelector('svg'));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(close);
  assert.equal(calls, 0);
});

test('activity timestamps are deterministic across server and browser locales', () => {
  render(
    h(UI.ActivityTimeline, {
      statuses: [status],
      items: [
        {
          id: '1',
          actor: { name: 'Alice' },
          payload: {
            beforeStatusId: status.id,
            afterStatusId: status.id,
            occurredAt: '2026-01-02T03:04:05.000Z',
          },
        },
      ],
    }),
  );
  assert.equal(globalThis.document.querySelector('time').textContent, '2026-01-02 03:04:05 UTC');
});

test('activity time normalizes offsets and handles an invalid display value safely', () => {
  for (const [occurredAt, expected] of [
    ['2026-01-02T08:34:05+05:30', '2026-01-02 03:04:05 UTC'],
    ['invalid', 'Invalid time'],
  ]) {
    render(
      h(UI.ActivityTimeline, {
        statuses: [status],
        items: [
          {
            id: '1',
            actor: { name: 'Alice' },
            payload: { beforeStatusId: status.id, afterStatusId: status.id, occurredAt },
          },
        ],
      }),
    );
    assert.equal(globalThis.document.querySelector('time').textContent, expected);
    cleanup();
  }
});

test('task row body opens exactly once and retains a useful focus origin', async () => {
  const opened = [];
  render(
    h(UI.TaskTable, {
      items: [
        {
          id: 'row',
          title: 'Row task',
          priority: 'normal',
          statusId: status.id,
          assignees: [],
          dueDate: null,
          customFields: {},
        },
      ],
      fields: [],
      statuses: [status],
      onOpenTask: (id) => opened.push(id),
    }),
  );
  const button = await screen.findByRole('button', { name: 'Open task: Row task' });
  const label = screen.getByText('In progress · Active');
  fireEvent.click(label);
  assert.deepEqual(opened, ['row']);
  assert.equal(globalThis.document.activeElement, button);
  opened.length = 0;
  fireEvent.click(button);
  assert.deepEqual(opened, ['row']);
});

test('row activation ignores modified, prevented, selected-text and interactive clicks', async () => {
  const opened = [];
  render(
    h(UI.TaskTable, {
      items: [
        {
          id: 'row',
          title: 'Row task',
          priority: 'normal',
          statusId: status.id,
          assignees: [],
          dueDate: null,
          customFields: {},
        },
      ],
      fields: [],
      statuses: [status],
      onOpenTask: (id) => opened.push(id),
    }),
  );
  await screen.findByRole('button', { name: 'Open task: Row task' });
  const label = screen.getByText('In progress · Active');
  for (const event of [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
  ]) {
    fireEvent.click(label, event);
    assert.deepEqual(opened, [], JSON.stringify(event));
  }
  label.addEventListener('click', (event) => event.preventDefault(), { once: true });
  fireEvent.click(label);
  assert.deepEqual(opened, [], 'preventDefault');
  const range = globalThis.document.createRange();
  range.selectNodeContents(label);
  globalThis.window.getSelection().removeAllRanges();
  globalThis.window.getSelection().addRange(range);
  assert.equal(globalThis.window.getSelection().isCollapsed, false);
  fireEvent.click(label);
  assert.deepEqual(opened, [], 'selected text');
  globalThis.window.getSelection().removeAllRanges();
  for (const tag of ['input', 'button', 'a']) {
    const control = globalThis.document.createElement(tag);
    label.closest('[role="gridcell"]').append(control);
    fireEvent.click(control);
    assert.deepEqual(opened, [], tag);
  }
  for (const value of ['', 'true', 'plaintext-only']) {
    const editable = globalThis.document.createElement('span');
    editable.setAttribute('contenteditable', value);
    editable.textContent = 'Edit me';
    label.closest('[role="gridcell"]').append(editable);
    fireEvent.click(editable);
    assert.deepEqual(opened, [], `contenteditable=${value}`);
  }
  assert.deepEqual(opened, []);
});

test('dialog close icons preserve the guarded dismiss callback and busy state', () => {
  const calls = [];
  const view = render(
    h(UI.Dialog, { open: true, onClose: (...args) => calls.push(args) }, 'Content'),
  );
  const close = screen.getByRole('button', { name: 'Close dialog' });
  assert.equal(close.textContent, '');
  assert.ok(close.querySelector('svg'));
  fireEvent.click(close);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 'escapeKeyDown');
  view.rerender(
    h(
      UI.Dialog,
      { open: true, closeDisabled: true, onClose: (...args) => calls.push(args) },
      'Content',
    ),
  );
  assert.equal(screen.getByRole('button', { name: 'Close dialog' }).disabled, true);
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  assert.equal(calls.length, 1);
  view.rerender(h(UI.Dialog, { open: true }, 'Non-dismissible'));
  assert.equal(screen.queryByRole('button', { name: 'Close dialog' }), null);
});
