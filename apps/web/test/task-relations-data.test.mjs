import assert from 'node:assert/strict';
import test from 'node:test';

import { readTaskRelations } from '../src/features/tasks/taskRelationsData.ts';

import { listId, task, workspaceId } from './common/board-fixture.mjs';

const parent = task(1);
const child = task(2, undefined, 1, { parentTaskId: parent.id });
const page = (items, nextCursor = null, dataVersion = 1) => ({
  response: {
    items,
    configVersion: 1,
    dataVersion,
    pageInfo: { hasNextPage: nextCursor !== null, nextCursor },
  },
});
const read = (pages, parentTaskId) =>
  readTaskRelations({ pages, listId, workspaceId, parentTaskId });

test('related pages preserve incomplete results and load later parent choices and children', () => {
  assert.equal(read([]).state, 'pending');
  const partial = read([page([], 'next')], parent.id);
  assert.equal(partial.state, 'ready');
  assert.equal(partial.nextCursor, 'next');
  const full = read([page([], 'next'), { ...page([child]), cursor: 'next' }], parent.id);
  assert.equal(full.state, 'ready');
  assert.deepEqual(
    full.items.map((item) => item.id),
    [child.id],
  );
  assert.equal(full.nextCursor, null);
  assert.deepEqual(read([page([parent])]).items, [parent]);
});

test('related pages reject hostile scope, wrong parents and repeated rows or cursors', () => {
  for (const change of [
    { workspaceId: '10000000-0000-4000-8000-000000000999' },
    { primaryListId: '10000000-0000-4000-8000-000000000999' },
    { parentTaskId: null },
    { archivedAt: '2026-10-25T10:00:00.000Z' },
    { id: parent.id },
  ])
    assert.equal(read([page([{ ...child, ...change }])], parent.id).state, 'invalid');
  assert.equal(read([page([child, child])], parent.id).state, 'invalid');
  assert.equal(
    read([page([], 'repeat'), { ...page([], 'repeat'), cursor: 'repeat' }]).state,
    'invalid',
  );
  assert.equal(read([page([]), page([])]).state, 'invalid');
  assert.equal(read([page([], 'next'), { ...page([]), cursor: 'wrong' }]).state, 'invalid');
});

test('mixed configuration or task revisions restart the whole relation snapshot', () => {
  const next = { ...page([], null, 2), cursor: 'next' };
  assert.equal(read([page([], 'next'), next]).state, 'stale');
  next.response.dataVersion = 1;
  next.response.configVersion = 2;
  assert.equal(read([page([], 'next'), next]).state, 'stale');
});
