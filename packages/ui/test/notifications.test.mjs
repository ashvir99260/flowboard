import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, StrictMode } from 'react';

import { ToastHost } from '../dist/index.js';

afterEach(cleanup);

test('StrictMode keeps the notification container registered across successive messages', async () => {
  const dismissed = [];
  const onDismiss = (id) => dismissed.push(id);
  const host = (message) =>
    createElement(StrictMode, null, createElement(ToastHost, { message, onDismiss }));
  const view = render(host(undefined));
  view.rerender(host({ id: 101, message: 'Task reordered.', severity: 'success' }));
  const first = await screen.findByRole('status', { name: 'Notification: Task reordered.' });
  assert.equal(screen.getAllByRole('status').length, 1);
  view.rerender(host({ id: 102, message: 'Task moved.', severity: 'success' }));
  await screen.findByRole('status', { name: 'Notification: Task moved.' });
  assert.equal(first.isConnected, false);
  assert.equal(screen.getAllByRole('status').length, 1);
  assert.equal(screen.getAllByRole('button', { name: 'Dismiss notification' }).length, 1);
  assert.deepEqual(dismissed, []);
});

test('a replacement notification does not wait for the dismissed toast exit animation', async () => {
  const dismissed = [];
  const onDismiss = (id) => dismissed.push(id);
  const host = (message) => createElement(ToastHost, { message, onDismiss });
  const view = render(host({ id: 1, message: 'Please correct the title.', severity: 'error' }));
  const first = await screen.findByRole('status', {
    name: 'Notification: Please correct the title.',
  });
  const close = screen.getByRole('button', { name: 'Dismiss notification' });
  assert.equal(close.textContent, '');
  assert.ok(close.querySelector('svg'));
  view.rerender(host(undefined));
  assert.equal(first.isConnected, false);
  // No animationend event: browsers can delay it while a tab is backgrounded.
  view.rerender(host({ id: 2, message: 'Task saved.', severity: 'success' }));
  const next = await screen.findByRole('status', { name: 'Notification: Task saved.' });
  fireEvent.keyDown(globalThis.document, { altKey: true, code: 'KeyT', key: 't' });
  assert.equal(globalThis.document.activeElement?.id, next.id);
  assert.deepEqual(dismissed, []);
});
