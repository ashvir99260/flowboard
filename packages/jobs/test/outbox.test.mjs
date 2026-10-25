import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createOutboxDispatcher,
  OutboxDefaults,
  outboxSettings,
  retryDelay,
} from '../dist/index.js';
import { closeOutboxResources } from '../dist/outbox.runtime.js';

for (const failure of ['publisher', 'loop'])
  test(`outbox ${failure} shutdown failure does not skip database teardown`, async () => {
    const calls = [];
    const original = new Error(`${failure} close failed`);
    const publisher = {
      close: async () => {
        calls.push('publisher');
        if (failure === 'publisher') throw original;
      },
    };
    const loop = Promise.resolve().then(() => {
      calls.push('loop');
      if (failure === 'loop') throw original;
    });
    const repository = { close: async () => calls.push('database') };
    await assert.rejects(
      closeOutboxResources(publisher, loop, repository),
      (error) => error === original,
    );
    assert.ok(calls.includes('database'));
  });

test('outbox teardown drains the loop and preserves the publisher error over later cleanup failures', async () => {
  const original = new Error('publisher failed');
  let release;
  let databaseClosed = false;
  const loop = new Promise((resolve) => {
    release = resolve;
  });
  const closing = closeOutboxResources(
    {
      close: async () => {
        throw original;
      },
    },
    loop,
    {
      close: async () => {
        databaseClosed = true;
        throw new Error('database failed');
      },
    },
  );
  const rejected = assert.rejects(closing, (error) => error === original);
  await Promise.resolve();
  assert.equal(databaseClosed, false);
  release();
  await rejected;
  assert.equal(databaseClosed, true);
});

test('outbox configuration keeps bounded polling, claims and retry delays', () => {
  assert.deepEqual(outboxSettings(), OutboxDefaults);
  for (const value of [0, 60001, NaN, Infinity])
    assert.throws(() => outboxSettings({ pollMs: value }), /Invalid outbox configuration/);
  assert.equal(retryDelay(1), 250);
  assert.equal(retryDelay(Number.MAX_SAFE_INTEGER), 60000);
});

test('concurrent dispatcher cycles share one lease acquisition and propagate storage failure', async () => {
  let release;
  let claims = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const dispatcher = createOutboxDispatcher(
    {
      claim: async () => {
        claims += 1;
        await gate;

        throw new Error('storage unavailable');
      },
    },
    { publish: async () => assert.fail('No unclaimed job may publish') },
  );
  const first = dispatcher.runOnce();
  const second = dispatcher.runOnce();
  const firstFailure = assert.rejects(first, /storage unavailable/);
  const secondFailure = assert.rejects(second, /storage unavailable/);
  release();
  await Promise.all([firstFailure, secondFailure]);
  assert.equal(claims, 1);
});
