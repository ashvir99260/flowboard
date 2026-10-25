import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bulkTaskDefaults,
  bulkTaskDraftSchema,
  bulkTaskInput,
  readBulkTaskResponse,
  selectBulkTasks,
} from '../src/features/list/bulk-task-data.ts';

import { boardFixture, field, task } from './common/board-fixture.mjs';

test('bulk selection captures versions, retains them on refresh, and bounds explicit IDs', () => {
  const first = task(1);
  const second = task(2);
  const selected = selectBulkTasks([], [first.id], [first, second]);
  assert.deepEqual(selected, [first]);
  assert.deepEqual(
    selectBulkTasks(selected, [first.id, second.id], [{ ...first, version: 9 }, second]),
    [first, second],
  );
  assert.deepEqual(selectBulkTasks(selected, [], [first]), []);
  assert.deepEqual(selectBulkTasks(selected, [first.id, 'unknown'], [first]), selected);
  assert.deepEqual(
    selectBulkTasks(
      [],
      Array.from({ length: 51 }, (_, index) => task(index + 1).id),
      Array.from({ length: 51 }, (_, index) => task(index + 1)),
    ),
    [],
  );
});

test('bulk drafts send only the chosen patch and retain zero, false, and explicit clearing', () => {
  const fixture = boardFixture();
  const fields = [...fixture.fields.items, field('approved', 'checkbox', false, 2)];
  const tasks = fixture.pages[0].response.items;
  const draft = bulkTaskDefaults(fields, fixture.statuses.items);
  assert.deepEqual(
    bulkTaskInput({ ...draft, operation: 'priority', priority: 'high' }, tasks, 1).patch,
    { priority: 'high' },
  );
  for (const [fieldKey, value] of [
    ['effort', 0],
    ['approved', false],
    ['effort', null],
  ]) {
    const next = {
      ...draft,
      operation: 'custom-field',
      fieldKey,
      customFields: { ...draft.customFields, [fieldKey]: value },
    };
    const parsed = bulkTaskDraftSchema(fields, fixture.statuses.items, tasks).parse(next);
    assert.deepEqual(bulkTaskInput(parsed, tasks, 1).patch, {
      customFields: { [fieldKey]: value },
    });
  }
  assert.deepEqual(bulkTaskInput({ ...draft, operation: 'assignees' }, tasks, 1).patch, {
    assigneeIds: [],
  });
});

test('bulk drafts reject invalid options, required clearing, and unknown statuses before submission', () => {
  const fixture = boardFixture();
  const tasks = fixture.pages[0].response.items;
  const draft = bulkTaskDefaults(fixture.fields.items, fixture.statuses.items);
  const schema = bulkTaskDraftSchema(fixture.fields.items, fixture.statuses.items, tasks);
  for (const changes of [
    { operation: 'status', statusId: 'unknown' },
    { operation: 'custom-field', fieldKey: 'area' },
    { operation: 'custom-field', fieldKey: 'missing' },
    { operation: 'custom-field', fieldKey: 'effort', customFields: { effort: 'wrong' } },
  ])
    assert.equal(schema.safeParse({ ...draft, ...changes }).success, false);
});

test('bulk response validation rejects mismatched identities, stale versions, and partial responses', () => {
  const fixture = boardFixture();
  const tasks = fixture.pages[0].response.items;
  const command = bulkTaskInput(
    {
      ...bulkTaskDefaults(fixture.fields.items, fixture.statuses.items),
      operation: 'priority',
      priority: 'high',
    },
    tasks,
    1,
  );
  const response = {
    data: tasks.map((item) => ({ ...item, priority: 'high', version: item.version + 1 })),
    changedTaskIds: tasks.map(({ id }) => id),
    configVersion: 1,
    dataVersion: 2,
  };
  const context = {
    fields: fixture.fields.items,
    statuses: fixture.statuses.items,
    tasks,
    command,
    listId: fixture.listId,
    workspaceId: fixture.workspaceId,
  };
  assert.equal(readBulkTaskResponse(response, context).success, true);
  for (const invalid of [
    { ...response, data: response.data.slice(1) },
    { ...response, data: response.data.toReversed() },
    { ...response, data: [{ ...response.data[0], version: tasks[0].version }, response.data[1]] },
    { ...response, data: [{ ...response.data[0], workspaceId: task(20).id }, response.data[1]] },
    { ...response, changedTaskIds: [task(20).id] },
    { ...response, configVersion: 2 },
  ])
    assert.equal(readBulkTaskResponse(invalid, context).success, false);
});
