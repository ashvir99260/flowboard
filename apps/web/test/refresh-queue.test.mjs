import assert from 'node:assert/strict';
import test from 'node:test';

import { createRefreshQueue } from '../src/lib/createRefreshQueue.ts';

test('refresh bursts wait for the current read and retain one trailing invalidation', () => {
  let calls = 0;
  const queue = createRefreshQueue(() => calls++);
  for (let index = 0; index < 6; index++) queue.request();
  assert.equal(calls, 0);
  queue.settle(false);
  assert.equal(calls, 1);
  for (let index = 0; index < 6; index++) queue.request();
  assert.equal(calls, 1);
  queue.settle(false);
  assert.equal(calls, 2);
  queue.settle(false);
  assert.equal(calls, 2);
});

test('a security/configuration reset discards a queued routine refresh', () => {
  let calls = 0;
  const queue = createRefreshQueue(() => calls++);
  queue.request();
  queue.clear();
  queue.settle(false);
  assert.equal(calls, 0);
  queue.request();
  assert.equal(calls, 1);
});

test('a queued refresh uses the latest callback rather than an old query closure', () => {
  const calls = [];
  const queue = createRefreshQueue(() => calls.push('old'));
  queue.request();
  queue.setRefresh(() => calls.push('current'));
  queue.settle(false);
  assert.deepEqual(calls, ['current']);
});
