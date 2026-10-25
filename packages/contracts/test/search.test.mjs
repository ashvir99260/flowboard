import { expect, test } from '@jest/globals';

import { SearchHitSchema, SearchPageSchema, SearchWorkspaceQuerySchema } from '../dist/index.js';

test('workspace search requires bounded Unicode text and cursor-only parameters', () => {
  expect(SearchWorkspaceQuerySchema.parse({ q: '  release notes  ' })).toEqual({
    limit: 50,
    q: 'release notes',
  });
  expect(SearchWorkspaceQuerySchema.safeParse({ q: '🚀'.repeat(200) }).success).toBe(true);
  for (const q of [undefined, '', '   ', '🚀'.repeat(201), '\0', '\ud800', 12, null])
    expect(SearchWorkspaceQuerySchema.safeParse({ q }).success).toBe(false);
  for (const extra of [{ offset: '1' }, { workspaceId: 'other' }, { limit: '101' }])
    expect(SearchWorkspaceQuerySchema.safeParse({ q: 'task', ...extra }).success).toBe(false);
});

test('search response exposes only bounded navigation fields and revisions', () => {
  const task = {
    id: '10000000-0000-4000-8000-000000000001',
    type: 'task',
    title: 'Release task',
    containerId: '10000000-0000-4000-8000-000000000002',
    path: ['Engineering', 'Delivery', 'Backlog'],
  };
  expect(SearchHitSchema.parse(task)).toEqual(task);
  expect(SearchHitSchema.safeParse({ ...task, type: 'space' }).success).toBe(false);
  expect(SearchHitSchema.safeParse({ ...task, description: 'Secret details' }).success).toBe(false);
  expect(SearchHitSchema.safeParse({ ...task, path: Array(4).fill('node') }).success).toBe(false);
  expect(
    SearchPageSchema.safeParse({
      items: [task],
      pageInfo: { hasNextPage: false, nextCursor: null },
      configVersion: 1,
      dataVersion: 1,
    }).success,
  ).toBe(true);
});
