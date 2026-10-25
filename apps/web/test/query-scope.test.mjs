import assert from 'node:assert/strict';
import test from 'node:test';

import { withQueryScope } from '../src/lib/queryScope.ts';

test('query scope preserves generated operation structure and separates users, workspaces and sessions', () => {
  const queryFn = () => 'result';
  const original = {
    queryFn,
    queryKey: [{ _id: 'listVisibleTree', query: { limit: 50 }, tags: ['existing'] }],
  };
  const scope = { revision: 1, userId: 'alice', workspaceId: 'workspace-a' };
  const result = withQueryScope(original, scope);
  assert.equal(result.queryFn, queryFn);
  assert.equal(result.queryKey.length, 1);
  assert.equal(result.queryKey[0]._id, 'listVisibleTree');
  assert.deepEqual(result.queryKey[0].query, { limit: 50 });
  assert.deepEqual(original.queryKey[0].tags, ['existing']);
  assert.equal(result.queryKey[0].tags[0], 'existing');
  for (const changed of [
    { ...scope, userId: 'bob' },
    { ...scope, workspaceId: 'workspace-b' },
    { ...scope, revision: 2 },
  ]) {
    assert.notDeepEqual(result.queryKey, withQueryScope(original, changed).queryKey);
  }
  assert.deepEqual(
    result.queryKey,
    withQueryScope(original, { revision: 1, userId: 'alice', workspaceId: 'workspace-a' }).queryKey,
  );
});
