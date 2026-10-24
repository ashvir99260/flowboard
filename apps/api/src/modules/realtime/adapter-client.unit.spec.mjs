import { setImmediate } from 'node:timers';

import { expect, test } from '@jest/globals';

import { observedAdapterClient } from '../../../dist/modules/realtime/adapter-client.js';

test('adapter command promises retain their result while unawaited rejections are observed', async () => {
  let failures = 0;
  const promise = Promise.reject(new Error('Redis unavailable'));
  const raw = { publish: () => promise, status: 'ready' };
  const wrapped = observedAdapterClient(raw, () => failures++);
  expect(wrapped.status).toBe('ready');
  expect(wrapped.publish('channel', 'value')).toBe(promise);
  await new Promise((resolve) => setImmediate(resolve));
  expect(failures).toBe(1);
});
