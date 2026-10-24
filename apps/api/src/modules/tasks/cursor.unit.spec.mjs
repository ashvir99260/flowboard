import { afterEach, expect, jest, test } from '@jest/globals';

import { CursorCodec } from '../../../dist/core/common/cursor.js';

const id = '10000000-0000-4000-8000-000000000001';
const binding = {
  caller: id,
  workspaceId: id,
  resource: `tasks:${id}`,
  limit: 2,
  fingerprint: 'a'.repeat(64),
};
afterEach(() => jest.restoreAllMocks());

test.each([
  { sort: 'manual', id, statusId: id, position: 2 },
  { sort: 'dueDate', id, dueDate: null },
  { sort: 'dueDate', id, dueDate: '2026-02-28' },
  { sort: 'priority', id, priority: 'urgent' },
])('task cursor retains exact sort position and fixed expiry: %j', (after) => {
  let now = Date.parse('2026-10-24T10:00:00Z');
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  const codec = new CursorCodec(new Uint8Array(32));
  const first = codec.encodeTask(binding, after, { configVersion: 3, dataVersion: 7 });
  const value = codec.decodeTask(first, binding);
  expect(value).toMatchObject({
    after,
    configVersion: 3,
    dataVersion: 7,
    expiresAt: now + 900_000,
  });
  now += 400_000;
  expect(
    codec.decodeTask(
      codec.encodeTask(binding, after, { configVersion: 3, dataVersion: 7 }, value),
      binding,
    ).expiresAt,
  ).toBe(value.expiresAt);
  expect(() => codec.decodeTask(first, { ...binding, fingerprint: 'b'.repeat(64) })).toThrow(
    expect.objectContaining({ code: 'INVALID_CURSOR' }),
  );
  expect(() => codec.decodeTree(first, binding)).toThrow(
    expect.objectContaining({ code: 'INVALID_CURSOR' }),
  );
  now += 500_000;
  expect(() => codec.decodeTask(first, binding)).toThrow(
    expect.objectContaining({ code: 'INVALID_CURSOR' }),
  );
});
