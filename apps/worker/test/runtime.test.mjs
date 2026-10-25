import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

for (const failure of ['worker', 'connection', 'publisher', 'database'])
  test(`activity ${failure} shutdown failure still attempts all resource cleanup`, async () => {
    const { closeActivityResources } = await import('../dist/activity.worker.js');
    const calls = [];
    const original = new Error(`${failure} close failed`);
    const cleanup = (name) => {
      calls.push(name);
      if (failure === name) throw original;
    };
    await assert.rejects(
      closeActivityResources({
        worker: { close: async () => cleanup('worker') },
        connection: { disconnect: () => cleanup('connection') },
        publisher: { disconnect: () => cleanup('publisher') },
        repository: { close: async () => cleanup('database') },
        active: new Set(),
      }),
      (error) => error === original,
    );
    assert.deepEqual(calls, ['worker', 'connection', 'publisher', 'database']);
  });

test('activity teardown drains in-flight jobs and preserves the worker close failure', async () => {
  const { closeActivityResources } = await import('../dist/activity.worker.js');
  const original = new Error('worker close failed');
  let release;
  let databaseClosed = false;
  const action = new Promise((resolve) => {
    release = resolve;
  });
  const closing = closeActivityResources({
    worker: {
      close: async () => {
        throw original;
      },
    },
    connection: { disconnect: () => {} },
    publisher: { disconnect: () => {} },
    repository: {
      close: async () => {
        databaseClosed = true;
        throw new Error('database failed');
      },
    },
    active: new Set([action]),
  });
  const rejected = assert.rejects(closing, (error) => error === original);
  await Promise.resolve();
  assert.equal(databaseClosed, false);
  release();
  await rejected;
  assert.equal(databaseClosed, true);
});

test('normal worker bootstrap owns outbox dispatch instead of the HTTP API', async () => {
  const worker = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  const api = await readFile(new URL('../../api/src/main.ts', import.meta.url), 'utf8');
  assert.match(worker, /createOutboxRuntime/);
  assert.doesNotMatch(api, /createOutboxRuntime/);
});

function fixture(failure) {
  const calls = [];
  let dispatchHealthy = true;
  const activity = {
    ready: async () => {
      calls.push('activity.ready');
      if (failure === 'activity') throw new Error('activity unavailable');
    },
    healthy: async () => true,
    close: async () => {
      calls.push('activity.close');
    },
  };
  const outbox = {
    start: () => calls.push('outbox.start'),
    ready: async () => {
      calls.push('outbox.ready');
      if (failure === 'outbox') throw new Error('outbox unavailable');
    },
    healthy: () => dispatchHealthy,
    close: async () => {
      calls.push('outbox.close');
    },
  };

  return { activity, outbox, calls, failDispatch: () => (dispatchHealthy = false) };
}

test('worker waits for consumer and dispatcher readiness and closes each resource once', async () => {
  const { startWorkerRuntime } = await import('../dist/runtime.js');
  const context = fixture();
  const runtime = await startWorkerRuntime(context.activity, context.outbox);
  assert.deepEqual(context.calls, ['activity.ready', 'outbox.start', 'outbox.ready']);
  assert.equal(await runtime.healthy(), true);
  context.failDispatch();
  assert.equal(await runtime.healthy(), false);
  await Promise.all([runtime.close(), runtime.close()]);
  assert.deepEqual(context.calls.slice(3).sort(), ['activity.close', 'outbox.close']);
  assert.equal(await runtime.healthy(), false);
});

for (const failure of ['activity', 'outbox'])
  test(`failed ${failure} startup closes consumer and dispatcher`, async () => {
    const { startWorkerRuntime } = await import('../dist/runtime.js');
    const context = fixture(failure);
    await assert.rejects(startWorkerRuntime(context.activity, context.outbox), /unavailable/);
    assert.equal(context.calls.filter((value) => value === 'activity.close').length, 1);
    assert.equal(context.calls.filter((value) => value === 'outbox.close').length, 1);
  });

test('a failed resource shutdown still closes the other resource', async () => {
  const { startWorkerRuntime } = await import('../dist/runtime.js');
  const context = fixture();
  context.outbox.close = async () => {
    context.calls.push('outbox.close');
    throw new Error('close failed');
  };
  const runtime = await startWorkerRuntime(context.activity, context.outbox);
  await assert.rejects(runtime.close(), /close failed/);
  assert.equal(context.calls.filter((value) => value === 'activity.close').length, 1);
});
