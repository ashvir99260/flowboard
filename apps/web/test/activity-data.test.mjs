import assert from 'node:assert/strict';
import test from 'node:test';

import { ActivitySchema } from '@flowboard/contracts';

import { assembleActivity } from '../src/features/tasks/activityData.ts';

test('activity pages reject foreign data, duplicate events, missing links and out-of-order entries', () => {
  const item = ActivitySchema.parse(ActivitySchema.meta().example);
  const input = {
    workspaceId: item.workspaceId,
    taskId: item.taskId,
    pages: [{ response: { items: [item], pageInfo: { hasNextPage: false, nextCursor: null } } }],
  };
  assert.equal(assembleActivity(input).state, 'ready');
  assert.equal(assembleActivity({ ...input, taskId: item.id }).state, 'invalid');
  assert.equal(assembleActivity({ ...input, workspaceId: item.id }).state, 'invalid');
  assert.equal(assembleActivity({ ...input, pages: [] }).state, 'pending');
  assert.equal(
    assembleActivity({
      ...input,
      pages: [
        { response: { items: [item, item], pageInfo: { hasNextPage: false, nextCursor: null } } },
      ],
    }).state,
    'invalid',
  );
  assert.equal(
    assembleActivity({
      ...input,
      pages: [{ cursor: 'unexpected', response: input.pages[0].response }],
    }).state,
    'invalid',
  );
});
