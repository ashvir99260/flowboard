import assert from 'node:assert/strict';
import test from 'node:test';

import { createNotificationStore } from '../src/features/notifications/notificationStore.ts';

test('an action reports one result but independent repeated saves remain visible', () => {
  const store = createNotificationStore();
  const report = store.capture();
  report('Task saved.', 'success');
  report('Duplicate result', 'error');
  store.capture()('Task saved.', 'success');
  assert.equal(store.snapshot().length, 2);
  assert.notEqual(store.snapshot()[0].id, store.snapshot()[1].id);
});

test('scope changes clear queued notices and suppress late success and error results', () => {
  const store = createNotificationStore();
  const success = store.capture();
  const error = store.capture();
  store.show('Existing', 'info');
  store.clear();
  success('Stale save', 'success');
  error('Stale failure', 'error');
  assert.deepEqual(store.snapshot(), []);
  store.capture()('Current', 'success');
  assert.equal(store.snapshot()[0].message, 'Current');
});

test('remote events deduplicate both move endpoints and reset at a scope change', () => {
  const store = createNotificationStore();
  store.remote('event', 'List updated.');
  store.remote('event', 'List updated.');
  assert.equal(store.snapshot().length, 1);
  store.clear();
  store.remote('event', 'List updated.');
  assert.equal(store.snapshot().length, 1);
});

test('burst queue stays bounded, dismissal advances it and subscriptions detach', () => {
  const store = createNotificationStore();
  let changes = 0;
  const stop = store.subscribe(() => changes++);
  for (let i = 0; i < 10; i++) store.show(String(i), 'info');
  assert.deepEqual(
    store.snapshot().map((entry) => entry.message),
    ['0', '6', '7', '8', '9'],
  );
  store.dismiss(store.snapshot()[0].id);
  assert.equal(store.snapshot()[0].message, '6');
  stop();
  store.clear();
  assert.equal(changes, 11);
});
