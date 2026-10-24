import { afterEach, expect, jest, test } from '@jest/globals';

import { CursorCodec } from '../../../dist/core/common/cursor.js';

const id = '10000000-0000-4000-8000-000000000001';
const binding = { caller: id, workspaceId: id, resource: 'tree', limit: 1 };
const after = [{ id, position: 2 }];
afterEach(() => jest.restoreAllMocks());

test('tree cursors bind both revisions, ignore extraneous workspace metadata and retain fixed expiry', () => {
  let now = Date.parse('2026-10-24T10:00:00Z');
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  const codec = new CursorCodec(new Uint8Array(32));
  const first = codec.encodeTree(binding, after, {
    id,
    name: 'Workspace',
    configVersion: 3,
    dataVersion: 9,
  });
  const payload = codec.decodeTree(first, binding);
  expect(payload).toMatchObject({
    configVersion: 3,
    dataVersion: 9,
    after,
    expiresAt: now + 900_000,
  });
  expect(payload).not.toHaveProperty('name');
  now += 400_000;
  const next = codec.encodeTree(binding, after, { configVersion: 3, dataVersion: 9 }, payload);
  expect(codec.decodeTree(next, binding).expiresAt).toBe(payload.expiresAt);
  expect(() => codec.decode(next, binding)).toThrow(
    expect.objectContaining({ code: 'INVALID_CURSOR' }),
  );
  const ordinary = codec.encode(binding, { createdAt: new Date(now), id });
  expect(() => codec.decodeTree(ordinary, binding)).toThrow(
    expect.objectContaining({ code: 'INVALID_CURSOR' }),
  );
  now += 500_000;
  expect(() => codec.decodeTree(next, binding)).toThrow(
    expect.objectContaining({ code: 'INVALID_CURSOR' }),
  );
});
