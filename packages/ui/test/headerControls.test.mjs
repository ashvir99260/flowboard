import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement as h } from 'react';

import * as UI from '../dist/index.js';

afterEach(cleanup);

test('account menu displays identity and reveals sign out only when opened', async () => {
  let signedOut = 0;
  render(h(UI.AccountMenu, { name: 'Alice Example', role: 'admin', onSignOut: () => signedOut++ }));
  const button = screen.getByRole('button', { name: 'Account menu for AE Alice Example admin' });
  assert.match(button.textContent, /AE/);
  assert.match(button.textContent, /admin/);
  assert.equal(screen.queryByRole('menuitem', { name: 'Sign out' }), null);
  fireEvent.click(button);
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
  assert.equal(signedOut, 1);
  await waitFor(() => assert.equal(screen.queryByRole('menu'), null));
});

test('header search has a clear accessible action', () => {
  let opened = 0;
  render(h(UI.HeaderSearchButton, { onClick: () => opened++ }));
  fireEvent.click(screen.getByRole('button', { name: 'Search tasks and lists' }));
  assert.equal(opened, 1);
});
