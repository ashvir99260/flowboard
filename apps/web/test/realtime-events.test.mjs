import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createInvalidationTracker,
  createRealtimeBus,
} from '../src/features/realtime/realtimeEvents.ts';
import { readRealtimeUrl } from '../src/server/realtimeConfig.ts';

const id = (n) => `f1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
test('deduplication retains both move endpoints, rejects content, and always allows reconnect resync', () => {
  const accept = createInvalidationTracker();
  const first = { kind: 'list', eventId: id(1), listId: id(2) };
  assert.deepEqual(accept(first), first);
  assert.equal(accept(first), null);
  assert.deepEqual(accept({ ...first, listId: id(3) }), { ...first, listId: id(3) });
  assert.equal(accept({ ...first, title: 'private' }), null);
  assert.deepEqual(accept({ kind: 'resync' }), { kind: 'resync' });
  assert.deepEqual(accept({ kind: 'resync' }), { kind: 'resync' });
});

test('realtime listeners follow list scope and unsubscribe without retaining removed views', () => {
  const bus = createRealtimeBus();
  const received = [];
  let changes = 0;
  const stopChanges = bus.onSubscriptionsChanged(() => changes++);
  const stop = bus.listen(id(1), (event) => received.push(event));
  bus.dispatch({ kind: 'list', eventId: id(2), listId: id(3) });
  assert.equal(received.length, 0);
  bus.dispatch({ kind: 'resync' });
  assert.equal(received.length, 1);
  assert.deepEqual(bus.lists(), [id(1)]);
  stop();
  assert.deepEqual(bus.lists(), []);
  assert.equal(changes, 2);
  stopChanges();
});

test('joining a list refreshes its consumers without reloading the tree or sibling lists', () => {
  const bus = createRealtimeBus();
  const received = [];
  bus.listen(undefined, (event) => received.push(['tree', event]));
  bus.listen(id(1), (event) => received.push(['joined', event]));
  bus.listen(id(2), (event) => received.push(['sibling', event]));

  bus.resyncList(id(1));
  assert.deepEqual(received, [['joined', { kind: 'resync' }]]);

  received.length = 0;
  bus.dispatch({ kind: 'resync' });
  assert.deepEqual(
    received.map(([name]) => name),
    ['tree', 'joined', 'sibling'],
  );
});

test('browser socket origin is runtime configuration independent of the internal API route', () => {
  assert.equal(readRealtimeUrl(undefined), null);
  assert.equal(
    readRealtimeUrl('https://preview-api.example.com'),
    'https://preview-api.example.com',
  );
  for (const url of [
    'javascript:alert(1)',
    'https://token@api.example.com',
    'https://api.example.com/path',
    'https://api.example.com/?secret=1',
  ])
    assert.throws(() => readRealtimeUrl(url));
});

test('local subscription catch-up is distinguishable from a global access resync', () => {
  const bus = createRealtimeBus();
  const received = [];
  bus.listen(id(1), (event, context) => received.push({ event, context }));
  bus.resyncList(id(1));
  bus.dispatch({ kind: 'resync' });
  assert.deepEqual(received, [
    { event: { kind: 'resync' }, context: { listId: id(1) } },
    { event: { kind: 'resync' }, context: undefined },
  ]);
});
