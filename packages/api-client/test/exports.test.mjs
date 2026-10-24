import assert from 'node:assert/strict';
import test from 'node:test';

test('public package exports provide generated SDK and TanStack helpers', async () => {
  const sdk = await import('@flowboard/api-client/sdk');
  const options = await import('@flowboard/api-client/tanstack-query');
  const types = await import('@flowboard/api-client/types');
  assert.equal(typeof sdk.listTasks, 'function');
  assert.equal(typeof options.listTasksQueryKey, 'function');
  assert.equal(typeof options.listTasksOptions, 'function');
  assert.equal(typeof options.listTasksInfiniteOptions, 'function');
  assert.equal(typeof options.createTaskMutation, 'function');
  assert.deepEqual(Object.keys(types), []);
});

test('generated query and mutation options execute their documented transport', async () => {
  const { listTasksOptions, createTaskMutation } =
    await import('@flowboard/api-client/tanstack-query');
  const requests = [];
  const page = {
    items: [],
    pageInfo: { hasNextPage: false, nextCursor: null },
    configVersion: 1,
    dataVersion: 1,
  };
  const transport = {
    baseUrl: 'https://flowboard.test',
    fetch: async (request) => {
      requests.push({
        method: request.method,
        url: request.url,
        body: request.method === 'POST' ? await request.json() : undefined,
      });

      return globalThis.Response.json(page);
    },
  };
  const query = listTasksOptions({
    ...transport,
    path: { listId: 'list-id' },
    query: { limit: '2' },
  });
  const result = await query.queryFn({
    queryKey: query.queryKey,
    signal: new AbortController().signal,
  });
  assert.deepEqual(result, page);
  const body = {
    expectedConfigVersion: 1,
    statusId: 'status-id',
    title: 'Created through generated options',
  };
  const mutation = createTaskMutation(transport);
  await mutation.mutationFn({ path: { listId: 'list-id' }, body });
  assert.deepEqual(requests, [
    {
      method: 'GET',
      url: 'https://flowboard.test/v1/lists/list-id/tasks?limit=2',
      body: undefined,
    },
    { method: 'POST', url: 'https://flowboard.test/v1/lists/list-id/tasks', body },
  ]);
});
