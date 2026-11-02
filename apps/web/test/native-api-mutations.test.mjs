import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('native mutation guards allow one write, isolate sessions and suppress late notifications', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--import',
      './test/common/source-loader.mjs',
      '--input-type=module',
    ],
    {
      cwd: new URL('../', import.meta.url),
      encoding: 'utf8',
      timeout: 10_000,
      input: `
      import assert from 'node:assert/strict';
      import { createElement } from 'react';
      import { renderToString } from 'react-dom/server';
      import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
      import { NotificationContext } from './src/features/notifications/notificationContext.ts';
      import { createNotificationStore } from './src/features/notifications/notificationStore.ts';
      import { useStatusMutation } from './src/features/config/statuses/useStatusMutation.ts';
      import { ApiMutationError } from './src/lib/apiError.ts';

      const client = new QueryClient();
      const notifications = createNotificationStore();
      const scope = { revision: 2, userId: 'alice', workspaceId: 'workspace-a' };
      const owner = { ownerType: 'workspace', ownerId: 'workspace-a' };
      const releases = [];
      let requests = 0;
      const runtime = { client: {
        getConfig: () => ({ baseUrl: 'https://example.test' }),
        delete: () => { requests++; return new Promise(resolve => releases.push(() => resolve({ data: undefined }))); },
      }};
      function mount(currentScope, options = {}) {
        let hook;
        function Harness() { hook = useStatusMutation(runtime, currentScope, owner, options); return null; }
        renderToString(createElement(QueryClientProvider, { client },
          createElement(NotificationContext.Provider, { value: notifications }, createElement(Harness))));
        return hook;
      }
      const command = { kind: 'remove', statusId: 'status-a', body: { expectedConfigVersion: 1 } };
      const settled = [];
      try {
        const first = mount(scope, { onSuccess: () => settled.push('saved') });
        const second = mount(scope);
        const one = first.mutateAsync(command);
        const two = second.mutateAsync(command);
        await assert.rejects(two, error => error instanceof ApiMutationError && error.code === 'BUSY');
        assert.equal(requests, 1);
        const otherSession = mount({ ...scope, revision: 3 });
        const three = otherSession.mutateAsync(command);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(requests, 2);
        notifications.clear();
        releases.forEach(release => release());
        assert.equal(await one, null);
        assert.equal(await three, null);
        assert.deepEqual(settled, ['saved']);
        assert.deepEqual(notifications.snapshot(), []);
        assert.equal(client.isMutating(), 0);
        const after = mount(scope);
        const four = after.mutateAsync(command);
        await new Promise(resolve => setImmediate(resolve));
        releases.at(-1)();
        assert.equal(await four, null);
        assert.equal(notifications.snapshot().length, 1);
      } finally { client.clear(); }
    `,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
