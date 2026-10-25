import assert from 'node:assert/strict';
import test from 'node:test';

import { QueryClient } from '@tanstack/react-query';

import { isTaskBusy, taskMutationAffectsList } from '../src/features/tasks/task-events.ts';

test('bulk task writes lock every selected task only in the same session and refresh its list', async () => {
  const client = new QueryClient();
  const scope = { revision: 2, userId: 'alice', workspaceId: 'workspace' };
  const key = ['task-write', 2, 'alice', 'workspace'];
  let release;
  const done = new Promise((resolve) => {
    release = resolve;
  });
  const command = { listId: 'list', tasks: [{ id: 'one' }, { id: 'two' }], body: {} };
  const mutation = client
    .getMutationCache()
    .build(client, { mutationKey: key, mutationFn: () => done });
  const running = mutation.execute(command);
  assert.equal(isTaskBusy(client, scope, 'one'), true);
  assert.equal(isTaskBusy(client, scope, 'two'), true);
  assert.equal(isTaskBusy(client, scope, 'three'), false);
  assert.equal(isTaskBusy(client, { ...scope, revision: 3 }, 'one'), false);
  assert.equal(taskMutationAffectsList(key, command, scope, 'list'), true);
  assert.equal(taskMutationAffectsList(key, command, scope, 'other-list'), false);
  release();
  await running;
  assert.equal(isTaskBusy(client, scope, 'one'), false);
  client.clear();
});
