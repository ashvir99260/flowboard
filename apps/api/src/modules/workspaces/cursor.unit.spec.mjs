import { TextEncoder } from 'node:util';

import { afterEach, expect, jest, test } from '@jest/globals';

import { CursorCodec } from '../../../dist/core/common/cursor.js';

const secret = new TextEncoder().encode('test-cursor-secret-abcdefghijklmnopqrstuvwxyz');
const binding = {
  caller: '10000000-0000-4000-8000-000000000001',
  limit: 1,
  resource: 'workspaces',
  workspaceId: '10000000-0000-4000-8000-000000000002',
};
const position = {
  createdAt: new Date('2026-10-24T10:00:00Z'),
  id: '10000000-0000-4000-8000-000000000003',
};
afterEach(() => jest.restoreAllMocks());

test('cursor expiry stays fixed across a chain and expires after fifteen minutes', () => {
  let clock = Date.parse('2026-10-24T10:00:00Z');
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  const codec = new CursorCodec(secret);
  const first = codec.encode(binding, position);
  const decoded = codec.decode(first, binding);
  expect(decoded.expiresAt).toBe(clock + 900_000);
  clock += 500_000;
  const second = codec.encode(binding, position, decoded);
  expect(codec.decode(second, binding).expiresAt).toBe(decoded.expiresAt);
  clock += 400_000;
  expect(() => codec.decode(second, binding)).toThrow(
    expect.objectContaining({ code: 'INVALID_CURSOR' }),
  );
});

test('cursors reject caller, selected workspace, resource, limit and signature changes', () => {
  const codec = new CursorCodec(secret);
  const token = codec.encode(binding, position);
  for (const change of [
    { caller: position.id },
    { workspaceId: null },
    { resource: 'members' },
    { limit: 2 },
  ]) {
    expect(() => codec.decode(token, { ...binding, ...change })).toThrow(
      expect.objectContaining({ code: 'INVALID_CURSOR' }),
    );
  }
  expect(() => new CursorCodec(new Uint8Array(32)).decode(token, binding)).toThrow();
  for (const value of ['', `${token}x`, 'malformed', 'x'.repeat(2049)])
    expect(() => codec.decode(value, binding)).toThrow();
});
