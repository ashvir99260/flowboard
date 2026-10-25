import assert from 'node:assert/strict';
import test from 'node:test';

import { navigateInitially } from './common/initial-navigation.mjs';

test('initial navigation retries a network-change interruption and returns the response', async () => {
  let calls = 0;
  const response = { status: 200 };
  const page = {
    goto: async (url) => {
      assert.equal(url, 'http://localhost/');
      calls++;
      if (calls === 1) throw new Error('page.goto: net::ERR_NETWORK_CHANGED');

      return response;
    },
  };
  assert.equal(await navigateInitially(page, 'http://localhost/'), response);
  assert.equal(calls, 2);
});

test('initial navigation preserves other errors and bounds repeated network interruptions', async () => {
  for (const [message, attempts] of [
    ['net::ERR_CONNECTION_REFUSED', 1],
    ['net::ERR_NETWORK_CHANGED', 3],
  ]) {
    let calls = 0;
    const failure = new Error(message);
    await assert.rejects(
      navigateInitially(
        {
          goto: async () => {
            calls++;
            throw failure;
          },
        },
        'http://localhost/',
      ),
      (error) => error === failure,
    );
    assert.equal(calls, attempts);
  }
});
