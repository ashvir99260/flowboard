import { createHmac } from 'node:crypto';

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
  { sort: 'dueDate', id, dueDate: '2026-02-28T00:00:00.000Z' },
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

test('legacy signed calendar-date cursors fail with INVALID_CURSOR', () => {
  const secret = new Uint8Array(32);
  const payload = Buffer.from(
    JSON.stringify({
      ...binding,
      v: 1,
      kind: 'tasks',
      expiresAt: Date.now() + 900000,
      configVersion: 1,
      dataVersion: 1,
      after: { sort: 'dueDate', id, dueDate: '2026-02-28' },
    }),
  ).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(`flowboard:cursor:v1:${payload}`)
    .digest('base64url');
  const codec = new CursorCodec(secret);
  expect(() => codec.decodeTask(`${payload}.${signature}`, binding)).toThrow(
    expect.objectContaining({ code: 'INVALID_CURSOR' }),
  );
});
