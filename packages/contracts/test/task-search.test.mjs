import { expect, test } from '@jest/globals';

import { ListTasksQuerySchema } from '../dist/index.js';

test('task search trims text, counts Unicode characters and remains optional', () => {
  expect(ListTasksQuerySchema.parse({ q: '  release notes  ' }).q).toBe('release notes');
  expect(ListTasksQuerySchema.parse({}).q).toBeUndefined();
  expect(ListTasksQuerySchema.safeParse({ q: '🚀'.repeat(200) }).success).toBe(true);
  for (const q of ['', '   ', '🚀'.repeat(201), '\0', '\ud800', 12, null])
    expect(ListTasksQuerySchema.safeParse({ q }).success).toBe(false);
});
