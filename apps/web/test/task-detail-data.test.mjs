import assert from 'node:assert/strict';
import test from 'node:test';

import { assembleTaskDetail } from '../src/features/tasks/taskDetailData.ts';

import { boardFixture, ids } from './common/board-fixture.mjs';

const setup = () => {
  const board = boardFixture();
  const task = board.pages[0].response.items[0];

  return {
    ...board,
    taskId: task.id,
    task: { data: task, configVersion: 1, dataVersion: 1 },
    memberPages: [
      {
        response: {
          items: [],
          configVersion: 1,
          pageInfo: { hasNextPage: false, nextCursor: null },
        },
      },
    ],
  };
};

test('task details require one valid scoped configuration and complete member pages', () => {
  const input = setup();
  const result = assembleTaskDetail(input);
  assert.equal(result.state, 'ready');
  assert.equal(result.task.id, input.taskId);
  assert.equal(result.configVersion, 1);
  assert.equal(assembleTaskDetail({ ...input, task: undefined }).state, 'pending');
  assert.equal(assembleTaskDetail({ ...input, memberPages: [] }).state, 'pending');
  assert.equal(assembleTaskDetail({ ...input, taskId: undefined, task: undefined }).state, 'ready');
});

test('task details reject foreign identities, unavailable status/fields and mixed revisions', () => {
  const input = setup();
  for (const changes of [
    { id: '50000000-0000-4000-8000-000000009999' },
    { workspaceId: '10000000-0000-4000-8000-000000009999' },
    { primaryListId: '20000000-0000-4000-8000-000000009999' },
    { statusId: ids.closed },
    { customFields: { effort: 'wrong', area: ids.option } },
    { archivedAt: '2026-10-24T10:00:00.000Z' },
  ])
    assert.equal(
      assembleTaskDetail({
        ...input,
        task: { ...input.task, data: { ...input.task.data, ...changes } },
      }).state,
      'invalid',
    );
  assert.equal(
    assembleTaskDetail({ ...input, task: { ...input.task, configVersion: 2 } }).state,
    'stale',
  );
  assert.equal(
    assembleTaskDetail({
      ...input,
      memberPages: [{ response: { ...input.memberPages[0].response, configVersion: 2 } }],
    }).state,
    'stale',
  );
});
