import assert from 'node:assert/strict';
import test from 'node:test';

import { assembleBoard, readBoardStatuses } from '../src/features/board/board-data.ts';

import {
  boardFixture,
  field,
  ids,
  page,
  status,
  task,
  workspaceId,
} from './common/board-fixture.mjs';

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }

  return value;
}

test('board preserves exact columns, empty columns, gaps and immutable schema/task input', () => {
  const input = freeze(boardFixture());
  const result = assembleBoard(input);
  assert.equal(result.state, 'ready');
  assert.deepEqual(
    result.columns.map(({ status: item }) => item.id),
    [ids.todo, ids.active, ids.done],
  );
  assert.deepEqual(
    result.columns.map(({ tasks }) => tasks.length),
    [2, 1, 0],
  );
  assert.equal(result.columns[0].tasks[0].customFields.effort, 0);
  assert.equal(result.columns[1].tasks[0].assignees[0].name, 'Alex Rivera');
  assert.equal(result.configVersion, 1);
  assert.equal(result.dataVersion, 1);
});

test('missing first pages stay pending and matching category/name does not merge distinct statuses', () => {
  const input = boardFixture();
  assert.equal(assembleBoard({ ...input, pages: input.pages.slice(1) }).state, 'pending');
  input.statuses.items.push(status(ids.closed, 'other_active', 'active', 3, 'In progress'));
  input.pages.push(page(ids.closed));
  assert.equal(assembleBoard(input).columns.length, 4);
});

test('every loaded task page including empty columns must share schema and data revisions', () => {
  const input = boardFixture();
  const variants = [
    { ...input, fields: { ...input.fields, configVersion: 2 } },
    {
      ...input,
      pages: [...input.pages.slice(0, 2), page(ids.done, [], undefined, null, { dataVersion: 2 })],
    },
    {
      ...input,
      pages: [
        page(ids.todo, [task(1)], undefined, null, { configVersion: 2 }),
        ...input.pages.slice(1),
      ],
    },
  ];
  for (const variant of variants) assert.equal(assembleBoard(variant).state, 'stale');
});

test('partial column pages remain usable while cursor chains reject crossing, loops and duplicates', () => {
  const input = boardFixture();
  input.pages[0] = page(ids.todo, [task(1)], undefined, 'todo-next');
  assert.equal(assembleBoard(input).columns[0].nextCursor, 'todo-next');
  const next = page(ids.todo, [task(2, ids.todo, 7)], 'todo-next');
  assert.equal(
    assembleBoard({ ...input, pages: [...input.pages, next] }).columns[0].tasks.length,
    2,
  );
  const variants = [
    [...input.pages, { ...next, request: { statusId: ids.todo, cursor: 'active-next' } }],
    [...input.pages, page(ids.todo, [task(2)], 'todo-next', 'todo-next')],
    [...input.pages, page(ids.todo, [task(1)], 'todo-next')],
    [...input.pages, next, next],
    [...boardFixture().pages, next],
  ];
  for (const pages of variants) assert.equal(assembleBoard({ ...input, pages }).state, 'invalid');
});

test('manual task ordering is validated across pages without sorting away regressions', () => {
  const input = boardFixture();
  input.pages[0] = page(ids.todo, [task(2, ids.todo, 7)], undefined, 'next');
  assert.equal(
    assembleBoard({
      ...input,
      pages: [...input.pages, page(ids.todo, [task(4, ids.todo, 7)], 'next')],
    }).state,
    'ready',
  );
  assert.equal(
    assembleBoard({
      ...input,
      pages: [...input.pages, page(ids.todo, [task(1, ids.todo, 7)], 'next')],
    }).state,
    'invalid',
  );
  assert.equal(
    assembleBoard({
      ...input,
      pages: [...input.pages, page(ids.todo, [task(4, ids.todo, 6)], 'next')],
    }).state,
    'invalid',
  );
});

test('foreign, archived and unknown-status tasks never become board cards', () => {
  const input = boardFixture();
  const variants = [
    task(9, ids.active),
    task(9, ids.todo, 0, { primaryListId: '20000000-0000-4000-8000-000000000099' }),
    task(9, ids.todo, 0, { workspaceId: '20000000-0000-4000-8000-000000000099' }),
    task(9, ids.todo, 0, { archivedAt: '2026-10-24T10:00:00.000Z' }),
  ];
  for (const item of variants)
    assert.equal(
      assembleBoard({ ...input, pages: [page(ids.todo, [item]), ...input.pages.slice(1)] }).state,
      'invalid',
    );
  assert.equal(
    assembleBoard({ ...input, pages: [...input.pages, page(ids.closed)] }).state,
    'invalid',
  );
});

test('configuration rejects duplicate IDs/keys, missing categories and noncanonical ordering', () => {
  const input = boardFixture();
  const variants = [
    [input.statuses.items[0], input.statuses.items[0], ...input.statuses.items.slice(1)],
    input.statuses.items.slice(0, 2),
    input.statuses.items.map((item) => (item.id === ids.active ? { ...item, key: 'todo' } : item)),
    [...input.statuses.items].reverse(),
    input.statuses.items.map((item) => ({
      ...item,
      workspaceId: '20000000-0000-4000-8000-000000000099',
    })),
  ];
  for (const items of variants)
    assert.equal(readBoardStatuses({ ...input.statuses, items }, workspaceId).state, 'invalid');
  const lexical = {
    configVersion: 1,
    items: [
      status(ids.todo, 'a0', 'not_started', 0),
      status(ids.active, 'a_', 'active', 0),
      status(ids.done, 'done', 'done', 1),
    ],
  };
  assert.equal(readBoardStatuses(lexical, workspaceId).state, 'ready');
});

test('shared field validation accepts required false/zero and rejects broken values and schemas', () => {
  const input = boardFixture();
  input.fields.items = [field('effort', 'number', true), field('confirmed', 'checkbox', true, 1)];
  input.pages = [
    page(ids.todo, [task(1, ids.todo, 0, { customFields: { confirmed: false, effort: 0 } })]),
    page(ids.active),
    page(ids.done),
  ];
  assert.equal(assembleBoard(input).state, 'ready');
  for (const customFields of [
    { effort: 0 },
    { confirmed: false, effort: '0' },
    { confirmed: false, effort: 0, unknown: 'bad' },
  ]) {
    assert.equal(
      assembleBoard({
        ...input,
        pages: [page(ids.todo, [task(1, ids.todo, 0, { customFields })]), ...input.pages.slice(1)],
      }).state,
      'invalid',
    );
  }
  input.fields.items.push(input.fields.items[0]);
  assert.equal(assembleBoard(input).state, 'invalid');
  const select = boardFixture();
  select.pages[0] = page(ids.todo, [task(1, ids.todo, 0, { customFields: { area: ids.closed } })]);
  assert.equal(assembleBoard(select).state, 'invalid');
});
