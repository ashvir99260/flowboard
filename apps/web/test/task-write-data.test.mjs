import assert from 'node:assert/strict';
import test from 'node:test';

import { readTaskWriteResponse } from '../src/features/tasks/taskWriteData.ts';

import { boardFixture, ids } from './common/board-fixture.mjs';

test('write response validation checks identity, status, raw fields and monotonic task versions', () => {
  const fixture = boardFixture();
  const task = fixture.pages[0].response.items[0];
  const expected = {
    taskId: task.id,
    listId: task.primaryListId,
    workspaceId: task.workspaceId,
    configVersion: 1,
    minVersion: 1,
    fields: fixture.fields.items,
    statuses: fixture.statuses.items,
  };
  const response = { data: task, configVersion: 1, dataVersion: 1, changedTaskIds: [task.id] };
  assert.equal(readTaskWriteResponse(response, expected).success, true);
  for (const changes of [
    { id: '50000000-0000-4000-8000-000000009999' },
    { workspaceId: '10000000-0000-4000-8000-000000009999' },
    { primaryListId: '20000000-0000-4000-8000-000000009999' },
    { statusId: ids.closed },
    { customFields: { effort: 'wrong', area: ids.option } },
    { customFields: { ...task.customFields, unexpected: 'value' } },
  ])
    assert.equal(
      readTaskWriteResponse({ ...response, data: { ...task, ...changes } }, expected).success,
      false,
    );
  assert.equal(readTaskWriteResponse(response, { ...expected, minVersion: 2 }).success, false);
  assert.equal(readTaskWriteResponse({ ...response, configVersion: 2 }, expected).success, false);
});
