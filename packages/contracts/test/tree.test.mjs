import { expect, test } from '@jest/globals';

import { compareTreePositions, resolveVisibleTree } from '../dist/index.js';

const node = (id, type, parentId, position = 0, visibility = 'public') => ({
  id,
  type,
  parentId,
  position,
  visibility,
  workspaceId: 'a',
  archivedAt: null,
});
const nodes = [
  node('s10', 'space', null, 10),
  node('s2', 'space', null, 2),
  node('f', 'folder', 's2'),
  node('l', 'list', 'f'),
];

test('visibility is ancestor-aware, fail-closed and leaves inputs untouched', () => {
  const before = globalThis.structuredClone(nodes);
  const ids = (grants, role = 'member', source = nodes) =>
    resolveVisibleTree(source, grants, 'a', role).map(({ node }) => node.id);
  expect(ids([])).toEqual(['s2', 's10', 'f', 'l']);
  expect(
    ids([
      { mode: 'deny', resourceId: 'f' },
      { mode: 'allow', resourceId: 'l' },
    ]),
  ).toEqual(['s2', 's10']);
  const privateNodes = nodes.map((n) => (n.id === 's2' ? { ...n, visibility: 'private' } : n));
  expect(ids([{ mode: 'allow', resourceId: 'l' }], 'member', privateNodes)).toEqual(['s10']);
  expect(ids([{ mode: 'allow', resourceId: 's2' }], 'member', privateNodes)).toEqual([
    's2',
    's10',
    'f',
    'l',
  ]);
  expect(ids([{ mode: 'deny', resourceId: 's2' }], 'admin', privateNodes)).toEqual([
    's2',
    's10',
    'f',
    'l',
  ]);
  for (const badParent of [
    { ...nodes[1], workspaceId: 'other' },
    { ...nodes[1], archivedAt: new Date() },
  ])
    expect(ids([], 'admin', [nodes[0], badParent, ...nodes.slice(2)])).toEqual(['s10']);
  expect(ids([], 'admin', [nodes[0], ...nodes.slice(2)])).toEqual(['s10']);
  expect(nodes).toEqual(before);
});

test('malformed and cyclic chains are inaccessible even to administrators', () => {
  expect(
    resolveVisibleTree([node('f', 'folder', 'l'), node('l', 'list', 'f')], [], 'a', 'admin'),
  ).toEqual([]);
  expect(resolveVisibleTree([node('list', 'list', null)], [], 'a', 'admin')).toEqual([]);
  expect(
    resolveVisibleTree([node('s', 'space', null), node('l', 'list', 's')], [], 'a', 'admin').map(
      ({ node }) => node.id,
    ),
  ).toEqual(['s']);
});

test('tree order uses depth then the whole numeric ancestor path and stable ID ties', () => {
  const source = [...nodes, node('f10', 'folder', 's10'), node('tie', 'folder', 's2')].reverse();
  const resolved = resolveVisibleTree(source, [], 'a', 'member');
  expect(resolved.map(({ node }) => node.id)).toEqual(['s2', 's10', 'f', 'tie', 'f10', 'l']);
  expect(
    compareTreePositions([{ id: 's', position: 2 }], [{ id: 's', position: 10 }]),
  ).toBeLessThan(0);
});
