import assert from 'node:assert/strict';
import test from 'node:test';

import { prepareMoveFields, projectPlacements } from '../src/features/board/taskPlacement.ts';

import { boardFixture, field, ids, listId, task } from './common/board-fixture.mjs';

const privateListId = '20000000-0000-4000-8000-000000000014';

function board() {
  const fixture = boardFixture();

  return fixture.statuses.items.map((status) => ({
    status,
    nextCursor: null,
    tasks: status.id === ids.todo ? [task(1), task(2), task(3)] : [],
  }));
}
const command = (item, request = {}) => ({
  taskId: item.id,
  sourceListId: item.primaryListId,
  sourceStatusId: item.statusId,
  request: {
    expectedVersion: item.version,
    expectedConfigVersion: 1,
    destinationListId: item.primaryListId,
    statusId: item.statusId,
    placement: { edge: 'end' },
    ...request,
  },
});
const order = (columns, statusId = ids.todo) =>
  columns.find((column) => column.status.id === statusId).tasks.map((item) => item.id);

test('pending reorder and status move are projections; authoritative arrays and revisions stay unchanged', () => {
  const columns = board();
  const original = structuredClone(columns);
  const reordered = projectPlacements(columns, listId, [command(task(1))]);
  assert.deepEqual(order(reordered), [task(2).id, task(3).id, task(1).id]);
  const moved = projectPlacements(columns, listId, [command(task(1), { statusId: ids.active })]);
  assert.deepEqual(order(moved), [task(2).id, task(3).id]);
  assert.deepEqual(order(moved, ids.active), [task(1).id]);
  assert.equal(moved[1].tasks[0].statusId, ids.active);
  assert.equal(moved[1].tasks[0].version, task(1).version);
  assert.deepEqual(columns, original);
});

test('rollback removes only its own projection, retaining another pending move', () => {
  const columns = board();
  const first = command(task(1), { statusId: ids.active });
  const second = command(task(2), { statusId: ids.done });
  assert.deepEqual(order(projectPlacements(columns, listId, [first, second])), [task(3).id]);
  const afterFailure = projectPlacements(columns, listId, [second]);
  assert.deepEqual(order(afterFailure), [task(1).id, task(3).id]);
  assert.deepEqual(order(afterFailure, ids.done), [task(2).id]);
});

test('newer task versions, another list and missing anchors are never overwritten by old optimism', () => {
  const columns = board();
  columns[0].tasks[0].version++;
  const pending = command(task(1), { statusId: ids.active });
  assert.deepEqual(projectPlacements(columns, listId, [pending]), columns);
  assert.deepEqual(projectPlacements(board(), privateListId, [pending]), board());
  const missing = command(task(1), { placement: { beforeId: task(99).id } });
  assert.deepEqual(projectPlacements(board(), listId, [missing]), board());
});

test('relative anchors exclude the moving task and preserve before/after placement', () => {
  const columns = board();
  assert.deepEqual(
    order(
      projectPlacements(columns, listId, [
        command(task(3), { placement: { beforeId: task(2).id } }),
      ]),
    ),
    [task(1).id, task(3).id, task(2).id],
  );
  assert.deepEqual(
    order(
      projectPlacements(columns, listId, [
        command(task(1), { placement: { afterId: task(2).id } }),
      ]),
    ),
    [task(2).id, task(1).id, task(3).id],
  );
  assert.deepEqual(
    projectPlacements(columns, listId, [command(task(1), { placement: { beforeId: task(1).id } })]),
    columns,
  );
});

test('absolute end on an incomplete column does not invent a position within its loaded prefix', () => {
  const columns = board();
  columns[1].nextCursor = 'more-active';
  const pending = command(task(1), { statusId: ids.active });
  const projected = projectPlacements(columns, listId, [pending]);
  assert.deepEqual(order(projected), [task(2).id, task(3).id]);
  assert.deepEqual(order(projected, ids.active), []);
  assert.equal(projected[1].nextCursor, 'more-active');
});

test('cross-list moves remove only the source card and leave destination snapshots alone', () => {
  const pending = command(task(1), { destinationListId: privateListId });
  assert.deepEqual(order(projectPlacements(board(), listId, [pending])), [task(2).id, task(3).id]);
  assert.deepEqual(projectPlacements(board(), privateListId, [pending]), board());
});

test('destination fields keep false/zero, explicitly clear source-only keys and validate corrections', () => {
  const fields = [...boardFixture().fields.items, field('approved', 'checkbox', true, 2)];
  const result = prepareMoveFields(
    { effort: 0, area: ids.option, approved: false, old_field: 'old' },
    fields,
    {},
  );
  assert.equal(result.success, true);
  assert.deepEqual(result.patch, { old_field: null });
  assert.deepEqual(result.removedKeys, ['old_field']);
  assert.deepEqual(result.values, { effort: 0, area: ids.option, approved: false });
  const missing = prepareMoveFields({ approved: false, effort: 0 }, fields, {});
  assert.equal(missing.success, false);
  assert.ok(missing.issues.some((issue) => issue.path.join('.') === 'customFields.area'));
  const corrected = prepareMoveFields({ approved: false, effort: 0 }, fields, { area: ids.option });
  assert.equal(corrected.success, true);
  assert.equal(prepareMoveFields({}, fields, { area: 'unknown' }).success, false);
  assert.equal(
    prepareMoveFields({ approved: false, area: ids.option }, fields, { unknown: 1 }).success,
    false,
  );
});
