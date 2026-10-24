import { expect, test } from '@jest/globals';

import { TaskUpdatedEventSchema, UpdateTaskSchema } from '../dist/index.js';

const id = '10000000-0000-4000-8000-000000000001';

test('undefined properties do not count as task edits or event changes', () => {
  expect(
    UpdateTaskSchema.safeParse({ title: undefined, expectedVersion: 1, expectedConfigVersion: 1 })
      .success,
  ).toBe(false);
  expect(
    TaskUpdatedEventSchema.safeParse({
      eventId: id,
      workspaceId: id,
      actorId: id,
      schemaVersion: 1,
      occurredAt: '2026-10-24T10:00:00.000Z',
      taskId: id,
      taskVersion: 1,
      previousListId: id,
      currentListId: id,
      changes: { title: undefined },
    }).success,
  ).toBe(false);
});
