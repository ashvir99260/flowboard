import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('named requests preserve generated parameters, cancellation and scoped query identity', () => {
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
      timeout: 10000,
      input: `
      import assert from 'node:assert/strict';
      import { createElement } from 'react';
      import { renderToString } from 'react-dom/server';
      import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
      import { fetchCurrentUser, useGetCurrentUserQuery } from './src/features/auth/useGetCurrentUserQuery.ts';
      import { fetchNode } from './src/features/tree/useGetNodeQuery.ts';
      import { fetchWorkspace } from './src/features/workspaces/useGetWorkspaceQuery.ts';
      import { fetchWorkspaces } from './src/features/workspaces/useListWorkspacesInfiniteQuery.ts';
      import { listWorkspacesInfiniteQueryKey } from '@flowboard/api-client/tanstack-query';
      import { requestAcceptWorkspaceInvitation } from './src/features/workspaces/useAcceptWorkspaceInvitationMutation.ts';
      import { requestStatus } from './src/features/config/statuses/useStatusMutation.ts';
      import { ApiMutationError } from './src/lib/apiError.ts';

      const calls = [];
      const payload = { marker: 'response' };
      const client = { getConfig: () => ({ baseUrl: 'https://example.test' }),
        get: async (options) => { calls.push(options); return { data: payload }; },
        post: async (options) => { calls.push(options); return { data: {} }; },
      };
      const signal = new AbortController().signal;
      assert.equal(await fetchCurrentUser(client, signal), payload);
      assert.equal(await fetchNode(client, 'node /?', signal), payload);
      assert.equal(await fetchWorkspace(client, 'workspace /?', signal), payload);
      assert.equal(calls[1].path.nodeId, 'node /?');
      assert.equal(calls[2].path.workspaceId, 'workspace /?');
      assert.ok(calls.every((call) => call.signal === signal && call.throwOnError === true));

      const queryClient = new QueryClient();
      const scope = { revision: 2, userId: 'alice', workspaceId: 'workspace-a' };
      function Harness() {
        useGetCurrentUserQuery({ runtime: { client }, scope }, { queryKey: ['unsafe'], queryFn: () => 'unsafe', retry: false });
        return null;
      }
      renderToString(createElement(QueryClientProvider, { client: queryClient }, createElement(Harness)));
      const query = queryClient.getQueryCache().getAll()[0];
      assert.equal(query.queryKey[0]._id, 'getCurrentUser');
      assert.ok(query.queryKey[0].tags.some((tag) => tag.includes('workspace-a')));
      const queryKey = listWorkspacesInfiniteQueryKey({ client, query: { limit: '50' } });
      assert.equal(await fetchWorkspaces(client, { queryKey, pageParam: 'next-page', signal, client: queryClient }), payload);
      assert.deepEqual(calls.at(-1).query, { limit: '50', cursor: 'next-page' });
      await assert.rejects(requestStatus(client, scope, { ownerType: 'workspace', ownerId: 'workspace-a' }, {
        kind: 'create', body: { kind: 'define', key: 'example', category: 'active', name: 'Example', color: '#123456', position: 1, expectedConfigVersion: 1 },
      }), (error) => error instanceof ApiMutationError && error.code === 'INVALID_RESPONSE');
      await assert.rejects(requestAcceptWorkspaceInvitation(client, 'A'.repeat(43)));
      assert.deepEqual(calls.at(-1).body, { token: 'A'.repeat(43) });
      queryClient.clear();
    `,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
