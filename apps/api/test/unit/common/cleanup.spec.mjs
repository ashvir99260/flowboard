import { expect, jest, test } from '@jest/globals';

import { closeOnce } from '../../common/cleanup.mjs';

test('shared fixture cleanup closes a resource once across concurrent owners', async () => {
  const close = jest.fn(async () => {});
  const cleanup = closeOnce(close);
  await Promise.all([cleanup(), cleanup(), cleanup()]);
  expect(close).toHaveBeenCalledTimes(1);
});

test('a failing cleanup is shared without repeating resource teardown', async () => {
  const failure = new Error('test teardown failure');
  const close = jest.fn(async () => {
    throw failure;
  });
  const cleanup = closeOnce(close);
  await expect(cleanup()).rejects.toBe(failure);
  await expect(cleanup()).rejects.toBe(failure);
  expect(close).toHaveBeenCalledTimes(1);
});
