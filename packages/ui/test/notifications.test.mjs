import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';

import { ToastHost } from '../dist/index.js';

afterEach(cleanup);

test('a replacement notification does not wait for the dismissed toast exit animation', () => {
  const dismissed = [];
  const onDismiss = (id) => dismissed.push(id);
  const host = (message) => createElement(ToastHost, { message, onDismiss });
  const view = render(host({ id: 1, message: 'Please correct the title.', severity: 'error' }));
  const first = screen.getByRole('status', { name: 'Notification: Please correct the title.' });
  view.rerender(host(undefined));
  assert.equal(first.isConnected, false);
  // No animationend event: browsers can delay it while a tab is backgrounded.
  view.rerender(host({ id: 2, message: 'Task saved.', severity: 'success' }));
  const next = screen.getByRole('status', { name: 'Notification: Task saved.' });
  fireEvent.keyDown(globalThis.document, { altKey: true, code: 'KeyT', key: 't' });
  assert.equal(globalThis.document.activeElement?.id, next.id);
  assert.deepEqual(dismissed, []);
});
