import assert from 'node:assert/strict';
import test from 'node:test';

import { createSessionSync } from '../dist/session-sync.js';

function browser(locks = true, storage = true) {
  const values = new Map();
  const calls = [];
  const window = new globalThis.EventTarget();
  window.localStorage = {
    getItem(key) {
      if (!storage) throw new Error('Unavailable');

      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
  window.navigator = {
    locks: locks
      ? {
          request: async (name, work) => {
            calls.push(name);

            return work();
          },
        }
      : undefined,
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });

  return { values, calls, window };
}

test('browser synchronization uses Web Locks and persists only opaque revisions', async () => {
  const fixture = browser();
  try {
    const first = createSessionSync();
    const second = createSessionSync();
    let notices = 0;
    const unsubscribe = second.subscribe(() => {
      notices++;
    });
    const before = second.version();
    const revision = first.bump();
    await Promise.resolve();
    assert.notEqual(revision, before);
    assert.equal(second.version(), revision);
    assert.equal(notices, 1);
    assert.deepEqual([...fixture.values.keys()], ['flowboard.session.revision']);
    assert.match(revision, /^[a-f\d-]{36}$/);
    assert.equal(await first.exclusive(async () => 'value'), 'value');
    assert.deepEqual(fixture.calls, ['flowboard.session']);
    unsubscribe();
    first.bump();
    await Promise.resolve();
    assert.equal(notices, 1);
  } finally {
    delete globalThis.window;
  }
});

for (const [locks, storage] of [
  [false, true],
  [true, false],
]) {
  test(`missing browser capability locks=${locks} storage=${storage} disables rotation`, () => {
    browser(locks, storage);
    try {
      assert.equal(createSessionSync().available, false);
    } finally {
      delete globalThis.window;
    }
  });
}

test('server-side synchronization instances do not share state or listeners', async () => {
  const first = createSessionSync();
  const second = createSessionSync();
  let notified = false;
  second.subscribe(() => {
    notified = true;
  });
  first.bump();
  await Promise.resolve();
  assert.equal(second.version(), 'initial');
  assert.equal(notified, false);
});

for (const operation of ['getItem', 'setItem']) {
  test(`storage ${operation} failure invalidates coordination and still notifies`, async () => {
    const fixture = browser();
    try {
      const sync = createSessionSync();
      const before = sync.version();
      let notices = 0;
      const unsubscribe = sync.subscribe(() => {
        notices++;
      });
      fixture.window.localStorage[operation] = () => {
        throw new Error('Unavailable');
      };
      const after = operation === 'getItem' ? sync.version() : sync.bump();
      await Promise.resolve();
      assert.equal(sync.available, false);
      assert.notEqual(after, before);
      assert.equal(notices, 1);
      assert.equal(sync.version(), after);
      unsubscribe();
    } finally {
      delete globalThis.window;
    }
  });
}
