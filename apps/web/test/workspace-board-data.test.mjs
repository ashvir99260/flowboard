import assert from 'node:assert/strict';
import test from 'node:test';

import { NodeSchema } from '@flowboard/contracts';

import {
  planWorkspaceMove,
  projectWorkspaceMoves,
  workspaceSnapshotState,
} from '../src/features/workspace-board/workspace-board-data.ts';

import {
  boardFixture,
  field,
  ids,
  listId,
  status,
  task,
  workspaceId,
} from './common/board-fixture.mjs';

const otherListId = '20000000-0000-4000-8000-000000000014';
const otherActiveId = '30000000-0000-4000-8000-000000000105';
function column(id = listId, tasks = []) {
  const fixture = boardFixture();

  return {
    list: NodeSchema.parse({ ...NodeSchema.meta().example, id, workspaceId, type: 'list' }),
    tasks,
    fields: fixture.fields.items,
    statuses: fixture.statuses.items,
    configVersion: 1,
    dataVersion: 1,
    nextCursor: null,
  };
}

test('workspace moves preserve same-list status even when dropped in another status group', () => {
  const first = task(1);
  const second = task(2, ids.todo, 7);
  const active = task(3, ids.active);
  const source = column(listId, [first, second, active]);
  const plan = planWorkspaceMove([source], first.id, listId, 2);
  assert.equal(plan.kind, 'ready');
  assert.equal(plan.command.request.statusId, ids.todo);
  assert.deepEqual(plan.command.request.placement, { afterId: second.id });
  const projected = projectWorkspaceMoves([source], [plan.command]);
  assert.deepEqual(
    projected[0].tasks.map((item) => item.id),
    [second.id, first.id, active.id],
  );
  assert.equal(projected[0].tasks[1].statusId, ids.todo);
  assert.deepEqual(
    source.tasks.map((item) => item.id),
    [first.id, second.id, active.id],
  );
});

test('cross-list mapping uses the destination status identity and preserves loaded suffix placement', () => {
  const moving = task(1, ids.active);
  const existing = task(2, otherActiveId, 0, { primaryListId: otherListId });
  const source = column(listId, [moving]);
  const destination = column(otherListId, [existing]);
  destination.statuses = destination.statuses.map((item) =>
    item.id === ids.active ? status(otherActiveId, 'delivery', 'active', 1, 'Delivery') : item,
  );
  destination.nextCursor = 'unloaded-suffix';
  const plan = planWorkspaceMove([source, destination], moving.id, otherListId, 1);
  assert.equal(plan.kind, 'ready');
  assert.equal(plan.command.request.statusId, otherActiveId);
  assert.deepEqual(plan.command.request.placement, { afterId: existing.id });
  const preview = projectWorkspaceMoves([source, destination], [plan.command]);
  assert.deepEqual(preview[0].tasks, []);
  assert.equal(preview[1].tasks[1].id, moving.id);
  assert.equal(preview[1].tasks[1].primaryListId, otherListId);
  assert.equal(preview[1].tasks[1].statusId, otherActiveId);
  assert.equal(preview[1].nextCursor, 'unloaded-suffix');
});

test('required fields, source-only values and unavailable categories open repair without changing cached tasks', () => {
  const moving = task(1);
  const source = column(listId, [moving]);
  const required = column(otherListId);
  required.fields = [...required.fields, field('release_note', 'text', true, 2)];
  assert.equal(planWorkspaceMove([source, required], moving.id, otherListId, 0).kind, 'repair');
  const removed = column(otherListId);
  removed.fields = removed.fields.filter((item) => item.key !== 'effort');
  assert.equal(planWorkspaceMove([source, removed], moving.id, otherListId, 0).kind, 'repair');
  const closed = task(2, ids.closed);
  source.tasks = [closed];
  source.statuses = [...source.statuses, status(ids.closed, 'closed', 'closed', 3)];
  assert.equal(
    planWorkspaceMove([source, column(otherListId)], closed.id, otherListId, 0).kind,
    'repair',
  );
  assert.equal(source.tasks[0].primaryListId, listId);
});

test('unknown lists and mismatched configuration are blocked without guessing access', () => {
  const moving = task(1);
  const source = column(listId, [moving]);
  const destination = column(otherListId);
  assert.equal(planWorkspaceMove([source], moving.id, otherListId, 0).kind, 'blocked');
  destination.configVersion = 2;
  assert.equal(planWorkspaceMove([source, destination], moving.id, otherListId, 0).kind, 'blocked');
});

test('removing a failed preview restores source data without undoing another task change', () => {
  const first = task(1);
  const second = task(2, ids.todo, 1);
  const source = column(listId, [first, second]);
  const destination = column(otherListId);
  const columns = [source, destination];
  const plan = planWorkspaceMove(columns, first.id, otherListId, 0);
  assert.equal(plan.kind, 'ready');
  assert.equal(projectWorkspaceMoves(columns, [plan.command])[0].tasks.length, 1);
  const newer = [
    { ...source, tasks: [first, { ...second, title: 'Another saved edit', version: 2 }] },
    destination,
  ];
  assert.equal(projectWorkspaceMoves(newer, [])[0].tasks[1].title, 'Another saved edit');
  assert.equal(projectWorkspaceMoves(newer, [])[0].tasks[0].id, first.id);
  const serverWon = [{ ...source, tasks: [{ ...first, version: 2 }, second] }, destination];
  assert.equal(projectWorkspaceMoves(serverWon, [plan.command])[0].tasks.length, 2);
});

test('mixed list revisions and duplicate task identities cannot share a drag context', () => {
  const moving = task(1);
  const source = column(listId, [moving]);
  const destination = column(otherListId, [{ ...moving, primaryListId: otherListId }]);
  destination.dataVersion = 2;
  assert.equal(workspaceSnapshotState([source, destination]), 'stale');
  destination.dataVersion = 1;
  assert.equal(workspaceSnapshotState([source, destination]), 'invalid');
  destination.tasks = [];
  assert.equal(workspaceSnapshotState([source, destination]), 'ready');
  destination.configVersion = 2;
  assert.equal(workspaceSnapshotState([source, destination]), 'stale');
});
