import { expect, test } from '@jest/globals';

import * as contracts from '../dist/index.js';

const id = 'f1000000-0000-4000-8000-000000000001';
test('socket subscriptions accept only a list identity, never an acting tenant or user', () => {
  expect(contracts.ListSubscriptionSchema).toBeDefined();
  expect(contracts.ListSubscriptionSchema.parse({ listId: id })).toEqual({ listId: id });
  for (const input of [
    { listId: 'wrong' },
    { listId: id, workspaceId: id },
    { listId: id, userId: id },
  ])
    expect(contracts.ListSubscriptionSchema.safeParse(input).success).toBe(false);
});

test('public invalidations cannot contain task contents or hidden move destinations', () => {
  expect(contracts.RealtimeInvalidationSchema).toBeDefined();
  const input = { kind: 'list', listId: id, eventId: id };
  expect(contracts.RealtimeInvalidationSchema.parse(input)).toEqual(input);
  for (const extra of [
    { currentListId: id },
    { title: 'private' },
    { changes: {} },
    { taskId: id },
  ])
    expect(contracts.RealtimeInvalidationSchema.safeParse({ ...input, ...extra }).success).toBe(
      false,
    );
  expect(contracts.RealtimeInvalidationSchema.parse({ kind: 'resync' })).toEqual({
    kind: 'resync',
  });
});

test('notification origin is an optional boolean and never admits actor metadata', () => {
  for (const kind of ['list', 'workspace']) {
    const input = { kind, eventId: id, ...(kind === 'list' ? { listId: id } : {}) };
    for (const self of [true, false])
      expect(contracts.RealtimeInvalidationSchema.parse({ ...input, self })).toEqual({
        ...input,
        self,
      });
    expect(
      contracts.RealtimeInvalidationSchema.safeParse({ ...input, self: 'false' }).success,
    ).toBe(false);
    expect(contracts.RealtimeInvalidationSchema.safeParse({ ...input, actorId: id }).success).toBe(
      false,
    );
  }
});
