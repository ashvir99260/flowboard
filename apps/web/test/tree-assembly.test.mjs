import assert from 'node:assert/strict';
import test from 'node:test';

import { NodeExamples, NodeSchema } from '@flowboard/contracts';

import { assembleTree } from '../src/features/tree/assemble-tree.ts';

const workspaceId = NodeExamples.node.workspaceId;
const node = (id, type, parentId, position = 0) =>
  NodeSchema.parse({ ...NodeExamples.node, id, name: id.slice(-3), type, parentId, position });
const space = node('10000000-0000-4000-8000-000000000011', 'space', null);
const folder = node('10000000-0000-4000-8000-000000000012', 'folder', space.id);
const list = node('10000000-0000-4000-8000-000000000013', 'list', folder.id);
const page = (items, nextCursor = null) => ({
  items,
  pageInfo: { hasNextPage: nextCursor !== null, nextCursor },
  configVersion: 1,
  dataVersion: 1,
  root: { id: workspaceId, type: 'workspace', name: 'Workspace' },
});

test('complete cursor pages assemble into ordered hierarchy without mutating server data', () => {
  const other = node('10000000-0000-4000-8000-000000000014', 'list', folder.id, 0);
  const result = assembleTree(
    [page([space, folder], 'next'), page([{ ...list, position: 1 }, other])],
    workspaceId,
  );
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.items[0].children[0].children.map(({ node }) => node.id),
    [other.id, list.id],
  );
  assert.equal(list.position, 0);
});

test('mixed revisions and malformed or cross-tenant trees never expose a partial hierarchy', () => {
  assert.deepEqual(
    assembleTree([page([space], 'next'), { ...page([folder, list]), dataVersion: 2 }], workspaceId),
    { ok: false, reason: 'stale' },
  );
  for (const pages of [
    [page([space], 'next')],
    [page([space, space])],
    [page([folder, list])],
    [page([{ ...space, parentId: list.id }])],
    [page([space, { ...folder, workspaceId: list.id }])],
    [page([space, { ...folder, parentId: list.id }, list])],
    [{ ...page([]), root: { id: list.id, name: 'Other workspace', type: 'workspace' } }],
  ])
    assert.deepEqual(assembleTree(pages, workspaceId), { ok: false, reason: 'invalid' });
});
