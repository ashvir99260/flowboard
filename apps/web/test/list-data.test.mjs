import assert from 'node:assert/strict';
import test from 'node:test';

import { assembleTaskList } from '../src/features/list/list-data.ts';

import { boardFixture, ids, listId, task, workspaceId } from './common/board-fixture.mjs';

const response = (items, nextCursor = null, versions = {}) => ({
  items,
  pageInfo: { nextCursor, hasNextPage: nextCursor !== null },
  configVersion: 1,
  dataVersion: 1,
  ...versions,
});
const input = (pages, query = { direction: 'asc', sort: 'dueDate' }) => ({
  workspaceId,
  listId,
  query,
  statuses: boardFixture().statuses,
  fields: boardFixture().fields,
  pages,
});

test('table pages retain server order, null dates last and complete resolved field columns', () => {
  const first = task(1, undefined, 0, { dueDate: '2026-10-24' });
  const second = task(2, undefined, 1, { dueDate: '2026-10-24' });
  const last = task(3);
  const pages = [
    { response: response([first, second], 'next-page') },
    { cursor: 'next-page', response: response([last]) },
  ];
  const original = structuredClone(pages);
  const result = assembleTaskList(input(pages));
  assert.equal(result.state, 'ready');
  assert.deepEqual(
    result.items.map((item) => item.id),
    [first.id, second.id, last.id],
  );
  assert.deepEqual(
    result.fields.map((field) => field.key),
    ['effort', 'area'],
  );
  assert.equal(result.nextCursor, null);
  assert.deepEqual(pages, original);
});

test('priority and manual orders use domain ranks and ascending ID ties', () => {
  const high = task(1, ids.todo, 7, { priority: 'high' });
  const urgent = task(2, ids.active, 0, { priority: 'urgent' });
  const nextHigh = task(3, ids.todo, 0, { priority: 'high' });
  const none = task(4, ids.done, 0, { priority: 'none' });
  for (const [sort, direction, items] of [
    ['priority', 'asc', [urgent, high, nextHigh, none]],
    ['priority', 'desc', [none, high, nextHigh, urgent]],
    ['manual', 'asc', [nextHigh, high, urgent, none]],
  ]) {
    const result = assembleTaskList(input([{ response: response(items) }], { sort, direction }));
    assert.equal(result.state, 'ready', `${sort}:${direction}`);
    assert.deepEqual(
      result.items.map((item) => item.id),
      items.map((item) => item.id),
    );
    assert.equal(
      assembleTaskList(input([{ response: response([...items].reverse()) }], { sort, direction }))
        .state,
      'invalid',
    );
  }
});

test('a filtered response must match the requested scalar, including zero', () => {
  const query = {
    direction: 'asc',
    fieldKey: 'effort',
    fieldOperator: 'eq',
    fieldValue: '0.0',
    sort: 'dueDate',
  };
  assert.equal(assembleTaskList(input([{ response: response([task(1)]) }], query)).state, 'ready');
  const wrong = task(1, undefined, 0, { customFields: { effort: 5, area: ids.option } });
  assert.equal(assembleTaskList(input([{ response: response([wrong]) }], query)).state, 'invalid');
});

test('empty and incomplete pages are distinct, and every page participates in revision checks', () => {
  assert.equal(assembleTaskList(input([])).state, 'pending');
  const empty = assembleTaskList(input([{ response: response([]) }]));
  assert.equal(empty.state, 'ready');
  assert.deepEqual(empty.items, []);
  const partial = assembleTaskList(input([{ response: response([task(1)], 'more') }]));
  assert.equal(partial.state, 'ready');
  assert.equal(partial.nextCursor, 'more');
  const drift = input([
    { response: response([task(1)], 'more') },
    { cursor: 'more', response: response([], null, { dataVersion: 2 }) },
  ]);
  assert.equal(assembleTaskList(drift).state, 'stale');
  drift.pages[1].response.dataVersion = 1;
  drift.fields.configVersion = 2;
  assert.equal(assembleTaskList(drift).state, 'stale');
});

test('foreign, archived, duplicate and malformed task rows cannot enter the table', () => {
  const overrides = [
    { workspaceId: '10000000-0000-4000-8000-000000009999' },
    { primaryListId: '20000000-0000-4000-8000-000000009999' },
    { statusId: '30000000-0000-4000-8000-000000009999' },
    { archivedAt: '2026-10-24T10:00:00.000Z' },
    { customFields: { effort: 'wrong', area: ids.option } },
  ];
  for (const override of overrides)
    assert.equal(
      assembleTaskList(input([{ response: response([task(1, undefined, 0, override)]) }])).state,
      'invalid',
    );
  assert.equal(
    assembleTaskList(input([{ response: response([task(1), task(1)]) }])).state,
    'invalid',
  );
  assert.equal(assembleTaskList(input([{ response: { items: [] } }])).state, 'invalid');
});

test('broken or repeated cursor chains never get silently joined', () => {
  for (const pages of [
    [{ cursor: 'orphan', response: response([]) }],
    [{ response: response([], 'more') }, { cursor: 'wrong', response: response([]) }],
    [{ response: response([]) }, { response: response([]) }],
    [{ response: response([], 'more') }, { cursor: 'more', response: response([], 'more') }],
  ])
    assert.equal(assembleTaskList(input(pages)).state, 'invalid');
});

test('descending dates still keep nulls last and equal-date IDs ascending', () => {
  const first = task(1, undefined, 0, { dueDate: '2026-10-25' });
  const second = task(2, undefined, 0, { dueDate: '2026-10-25' });
  const older = task(3, undefined, 0, { dueDate: '2026-10-24' });
  const missing = task(4);
  const query = { direction: 'desc', sort: 'dueDate' };
  assert.equal(
    assembleTaskList(input([{ response: response([first, second, older, missing]) }], query)).state,
    'ready',
  );
  for (const items of [
    [missing, first],
    [older, first],
    [second, first],
  ])
    assert.equal(assembleTaskList(input([{ response: response(items) }], query)).state, 'invalid');
});

test('field sources, inheritance, identity and order must describe the selected list truthfully', () => {
  for (const update of [
    (fields) => {
      fields[0].source.fieldId = fields[1].id;
    },
    (fields) => {
      fields[0].source.updatedAt = '2026-10-25T00:00:00.000Z';
    },
    (fields) => {
      fields[0].isInherited = false;
    },
    (fields) => {
      fields[1].key = fields[0].key;
    },
    (fields) => {
      fields[1].id = fields[0].id;
    },
    (fields) => {
      fields.reverse();
    },
  ]) {
    const candidate = input([{ response: response([]) }]);
    update(candidate.fields.items);
    assert.equal(assembleTaskList(candidate).state, 'invalid');
  }
});
