import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('consumer mutation observer failures do not replace request outcomes', () => {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--input-type=module'],
    {
      cwd: new URL('../', import.meta.url),
      encoding: 'utf8',
      timeout: 10_000,
      input: `
      import assert from 'node:assert/strict';
      import { createElement } from 'react';
      import { renderToString } from 'react-dom/server';
      import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
      import { useApiMutation } from './src/lib/useApiMutation.ts';
      const client = new QueryClient();
      const reported = [];
      const events = [];
      globalThis.reportError = (error) => reported.push(error);
      let hook;
      function Harness({ options }) { hook = useApiMutation(options); return null; }
      function mount(options) {
        renderToString(createElement(QueryClientProvider, { client }, createElement(Harness, { options })));
        return hook;
      }
      try {
        const success = mount({
          mutationKey: ['test'], mutationFn: async (value) => value,
          onSuccess: async (data, value) => {
            await Promise.resolve();
            events.push([data, value]);
            throw new Error('private callback content');
          },
          onSettled: () => events.push('settled'),
        });
        assert.equal(await success.mutateAsync(7), 7);
        assert.deepEqual(events, [[7, 7], 'settled']);
        assert.equal(reported.length, 1);
        assert.doesNotMatch(reported[0].message, /private/);
        const failure = new Error('original request failure');
        const rejected = mount({
          mutationKey: ['failure'], mutationFn: async () => { throw failure; },
          onError: (error) => { assert.equal(error, failure); throw new Error('observer failed'); },
          onSettled: () => { throw new Error('settled failed'); },
        });
        await assert.rejects(rejected.mutateAsync(8), (error) => error === failure);
        assert.equal(reported.length, 3);
      } finally { client.clear(); }
    `,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('API mutations preserve commands, keys and callbacks while disabling retries and offline queuing', () => {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--input-type=module'],
    {
      cwd: new URL('../', import.meta.url),
      encoding: 'utf8',
      timeout: 10_000,
      input: `
        import assert from 'node:assert/strict';
        import { createElement } from 'react';
        import { renderToString } from 'react-dom/server';
        import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
        import { useApiMutation } from './src/lib/useApiMutation.ts';

        const client = new QueryClient({ defaultOptions: { mutations: { retry: 3 } } });
        const command = { taskId: 'task-a', body: { title: 'Updated' } };
        const mutationKey = ['task-write', 2, 'alice', 'workspace-a'];
        const callbackEvents = [];
        let hook;
        let calls = 0;
        function Harness({ options }) {
          hook = useApiMutation(options);
          return null;
        }
        function mount(options) {
          renderToString(createElement(QueryClientProvider, { client }, createElement(Harness, { options })));
          return hook;
        }

        try {
          onlineManager.setOnline(false);
          const mutation = mount({
            mutationKey,
            mutationFn: async (input, context) => {
              calls++;
              assert.equal(input, command);
              assert.equal(context.client, client);
              assert.equal(context.mutationKey, mutationKey);
              return { id: input.taskId };
            },
            onMutate: (input) => {
              assert.equal(input, command);
              return { previous: 'original' };
            },
            onSuccess: (data, input, previous) => callbackEvents.push([data.id, input.taskId, previous.previous]),
            onSettled: () => callbackEvents.push('settled'),
          });
          assert.deepEqual(await mutation.mutateAsync(command), { id: 'task-a' });
          const stored = client.getMutationCache().getAll()[0];
          assert.equal(stored.options.mutationKey, mutationKey);
          assert.equal(stored.state.variables, command);
          assert.equal(stored.options.retry, false);
          assert.equal(stored.options.networkMode, 'always');
          assert.equal(calls, 1);
          assert.deepEqual(callbackEvents, [['task-a', 'task-a', 'original'], 'settled']);

          const failure = new Error('Rejected by the server');
          let failures = 0;
          const rejected = mount({
            mutationKey: ['configuration-write', 2, 'alice', 'workspace-a'],
            mutationFn: async () => { failures++; throw failure; },
            onError: (error) => assert.equal(error, failure),
          });
          await assert.rejects(rejected.mutateAsync(command), (error) => error === failure);
          assert.equal(failures, 1);
        } finally {
          onlineManager.setOnline(true);
          client.clear();
        }
      `,
    },
  );

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
