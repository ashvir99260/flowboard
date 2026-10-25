import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { ResolvedFieldSchema } from '@flowboard/contracts';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement as h } from 'react';

import { TaskTable } from '../dist/index.js';
import { readTaskFilter, taskFilterModel } from '../dist/modules/tasks/taskTableControls.js';

afterEach(cleanup);

const items = [
  {
    id: '1',
    title: 'Server first',
    priority: 'low',
    statusId: 'todo',
    assignees: [],
    dueDate: '2026-01-01T00:00:00.000Z',
    customFields: { effort: 2 },
  },
  {
    id: '2',
    title: 'Server second',
    priority: 'urgent',
    statusId: 'todo',
    assignees: [],
    dueDate: '2026-01-02T00:00:00.000Z',
    customFields: { effort: 1 },
  },
];
const effort = ResolvedFieldSchema.parse({
  ...ResolvedFieldSchema.meta().example,
  name: 'Effort',
  key: 'effort',
});

test('native column sorting reports server order changes without sorting partial rows locally', async () => {
  const changes = [];
  render(
    h(TaskTable, {
      items,
      fields: [effort],
      statuses: [],
      onOpenTask: () => {},
      controls: {
        sort: null,
        filter: null,
        onSortChange: (value) => changes.push(value),
        onFilterChange: () => {},
      },
    }),
  );
  assert.equal(screen.getByText('Jan 1').getAttribute('title'), 'Due · 2026-01-01 00:00:00 UTC');
  fireEvent.click(await screen.findByRole('columnheader', { name: 'Priority' }));
  assert.deepEqual(changes, [{ direction: 'asc', field: 'priority' }]);
  assert.deepEqual(
    screen.getAllByRole('rowheader').map((cell) => cell.textContent),
    ['Server first', 'Server second'],
  );
  fireEvent.click(screen.getByRole('columnheader', { name: 'Title' }));
  assert.equal(changes.length, 1, 'unsupported sort columns do not imply server-wide ordering');
});

test('native filter drafts stay local until complete and report zero without filtering loaded rows', async () => {
  const changes = [];
  render(
    h(TaskTable, {
      items,
      fields: [effort],
      statuses: [],
      onOpenTask: () => {},
      controls: {
        sort: null,
        filter: null,
        onSortChange: () => {},
        onFilterChange: (value) => changes.push(value),
      },
    }),
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Filters' }));
  assert.deepEqual(changes, [], 'opening an incomplete filter does not query');
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Value' }), { target: { value: '0' } });
  await waitFor(() => assert.deepEqual(changes, [{ key: 'effort', operator: 'eq', value: 0 }]));
  assert.equal(screen.getAllByRole('rowheader').length, 2);
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  assert.equal(screen.getAllByRole('rowheader').length, 2);
});

const optionId = '30000000-0000-4000-8000-00000000000a';
const fieldOfType = (type) => ({
  ...effort,
  key: type,
  type,
  options: ['single_select', 'multi_select'].includes(type) ? [{ id: optionId, label: 'Web' }] : [],
});

test('native filter values retain every supported field type, including zero and false', () => {
  for (const [type, input, value, operator] of [
    ['number', 0, 0, 'eq'],
    ['text', 'Release', 'Release', 'eq'],
    ['checkbox', false, false, 'eq'],
    ['date', new Date('2026-10-25T00:00:00.000Z'), '2026-10-25', 'eq'],
    ['single_select', optionId, optionId, 'eq'],
    ['multi_select', optionId, optionId, 'contains'],
  ]) {
    assert.deepEqual(
      readTaskFilter({ items: [{ field: `custom:${type}`, operator, value: input }] }, [
        fieldOfType(type),
      ]),
      {
        complete: true,
        filter: { key: type, operator, value },
      },
    );
  }
});

test('incomplete, invalid or unsupported native filters never reach the API', () => {
  for (const [type, value, operator] of [
    ['number', 'not a number', 'eq'],
    ['number', '', 'eq'],
    ['number', null, 'eq'],
    ['checkbox', 'false', 'eq'],
    ['date', new Date('invalid'), 'eq'],
    ['single_select', 'missing', 'eq'],
    ['multi_select', optionId, 'eq'],
    ['text', 'Release', 'contains'],
  ])
    assert.deepEqual(
      readTaskFilter({ items: [{ field: `custom:${type}`, operator, value }] }, [
        fieldOfType(type),
      ]),
      { complete: false },
    );
  assert.deepEqual(
    readTaskFilter({ items: [{ field: 'foreign', operator: 'eq', value: 0 }] }, [effort]),
    { complete: false },
  );
  assert.deepEqual(readTaskFilter({ items: [] }, [effort]), { complete: true, filter: null });
});

test('restored option filters display canonical IDs without rewriting their original query', () => {
  const filter = { key: 'multi_select', operator: 'contains', value: optionId.toUpperCase() };
  assert.deepEqual(taskFilterModel(filter, [fieldOfType('multi_select')]), {
    items: [
      { id: 'multi_select', field: 'custom:multi_select', operator: 'contains', value: optionId },
    ],
  });
  assert.equal(filter.value, optionId.toUpperCase());
});

test('date custom fields render in the grid while preserving their calendar date', async () => {
  render(
    h(TaskTable, {
      items: [{ ...items[0], customFields: { date: '2026-10-25' } }],
      fields: [fieldOfType('date')],
      statuses: [],
      onOpenTask: () => {},
      controls: { sort: null, filter: null, onSortChange: () => {}, onFilterChange: () => {} },
    }),
  );
  assert.ok(await screen.findByText('Effort: Oct 25, 2026'));
});
