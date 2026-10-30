import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement as h } from 'react';

import {
  MemberAccess,
  SettingsDetailPanel,
  SettingsLayout,
  SettingsList,
  ToastHost,
} from '../dist/index.js';

afterEach(cleanup);

test('active settings panels own notifications and release them when inactive', async () => {
  const message = { id: 7001, message: 'Status saved.', severity: 'success' };
  const onDismiss = () => {};
  const content = (active, currentMessage) =>
    h(
      ToastHost,
      {
        message: currentMessage,
        onDismiss,
      },
      h(
        SettingsDetailPanel,
        {
          active,
          title: 'Status details',
          closeLabel: 'Close status details',
          onClose() {},
        },
        h('button', {}, 'Save status'),
      ),
    );
  const view = render(content(true, undefined));
  view.rerender(content(true, message));
  const panel = screen.getByRole('region', { name: 'Status details' });
  await waitFor(() => assert.ok(panel.querySelector('.Toastify__toast')));
  assert.ok(panel.contains(screen.getByRole('status', { name: 'Notification: Status saved.' })));
  view.rerender(content(false, message));
  await waitFor(() => assert.equal(panel.querySelector('.Toastify__toast'), null));
  await waitFor(() =>
    assert.ok(screen.getByRole('status', { name: 'Notification: Status saved.' })),
  );
});

test('member grants provide a keyboard-accessible scroll region in narrow panels', () => {
  render(h(MemberAccess, { members: [], grants: [], busy: false, onEdit() {} }));
  assert.equal(screen.getByRole('region', { name: 'Scrollable member grants' }).tabIndex, 0);
});

test('settings rows expose names, metadata, selection and disabled actions', () => {
  const opened = [];
  render(
    h(
      SettingsList.Root,
      { 'aria-label': 'Statuses' },
      h(SettingsList.Item, {
        title: 'In progress',
        description: 'active · Inherited',
        selected: true,
        onClick: () => opened.push('active'),
      }),
      h(SettingsList.Item, {
        title: 'Done',
        description: 'done · Local',
        disabled: true,
        onClick: () => opened.push('done'),
      }),
    ),
  );
  assert.equal(
    screen.getByRole('button', { name: /In progress/ }).getAttribute('aria-pressed'),
    'true',
  );
  fireEvent.click(screen.getByRole('button', { name: /In progress/ }));
  fireEvent.click(screen.getByRole('button', { name: /Done/ }));
  assert.deepEqual(opened, ['active']);
  assert.equal(screen.getAllByRole('listitem').length, 2);
});

test('detail panel keeps surrounding controls available and delegates guarded closing', () => {
  let closes = 0;
  const view = render(
    h(SettingsLayout, {
      collection: h('button', {}, 'Change scope'),
      detail: h(
        SettingsDetailPanel,
        {
          title: 'Status details',
          closeLabel: 'Close status details',
          onClose: () => closes++,
        },
        h('input', { 'aria-label': 'Name' }),
      ),
    }),
  );
  const panel = screen.getByRole('region', { name: 'Status details' });
  assert.equal(screen.getByRole('button', { name: 'Change scope' }).disabled, false);
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Name' }), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Close status details' }));
  assert.equal(closes, 2);
  view.rerender(
    h(
      SettingsDetailPanel,
      {
        title: 'Status details',
        closeLabel: 'Close status details',
        closeDisabled: true,
        onClose: () => closes++,
      },
      h('input', { 'aria-label': 'Name' }),
    ),
  );
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Name' }), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Close status details' }));
  assert.equal(closes, 2);
  assert.ok(panel);
});
