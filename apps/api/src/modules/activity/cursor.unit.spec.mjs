import { afterEach, expect, jest, test } from '@jest/globals';

import { CursorCodec } from '../../../dist/core/common/cursor.js';

afterEach(() => jest.restoreAllMocks());
test('activity continuation retains its upper watermark and original expiry', () => {
  let now = Date.parse('2026-10-24T10:00:00.000Z');
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  const id = '81000000-0000-4000-8000-000000000001';
  const binding = { caller: id, workspaceId: id, resource: `activity:${id}`, limit: 2 };
  const position = { createdAt: new Date(now), id };
  const codec = new CursorCodec(new Uint8Array(32));
  const cursor = codec.encodeActivity(binding, position, position);
  const first = codec.decodeActivity(cursor, binding);
  expect(first.upper).toEqual({ createdAt: position.createdAt.toISOString(), id });
  now += 400000;
  expect(
    codec.decodeActivity(codec.encodeActivity(binding, position, position, first), binding)
      .expiresAt,
  ).toBe(first.expiresAt);
  expect(() => codec.decode(cursor, binding)).toThrow(
    expect.objectContaining({ code: 'INVALID_CURSOR' }),
  );
  now += 500000;
  expect(() => codec.decodeActivity(cursor, binding)).toThrow(
    expect.objectContaining({ code: 'INVALID_CURSOR' }),
  );
});
