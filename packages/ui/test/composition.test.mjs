import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, createRef } from 'react';

import * as UI from '../dist/index.js';

afterEach(cleanup);

test('surface parts compose arbitrary content and forward semantic attributes and refs', () => {
  assert.ok(UI.Surface, 'The shared Surface composition API must exist');
  const ref = createRef();
  render(
    createElement(
      UI.Surface.Root,
      { ref, 'aria-label': 'Workspace settings' },
      createElement(
        UI.Surface.Header,
        null,
        createElement(UI.Surface.Title, { component: 'h2' }, 'Access'),
        createElement(UI.Surface.Description, null, 'Manage your workspace.'),
      ),
      createElement(
        UI.Surface.Body,
        null,
        createElement('input', { 'aria-label': 'Workspace name' }),
      ),
      createElement(UI.Surface.Footer, null, createElement('button', null, 'Save')),
    ),
  );
  assert.equal(ref.current, screen.getByLabelText('Workspace settings'));
  assert.ok(screen.getByRole('heading', { level: 2, name: 'Access' }));
  assert.ok(screen.getByRole('textbox', { name: 'Workspace name' }));
  assert.ok(screen.getByRole('button', { name: 'Save' }));
});

test('styled controls retain disabled behavior and link composition', () => {
  assert.ok(UI.Button, 'Shared styled Button must exist');
  let calls = 0;
  render(
    createElement(
      UI.Button,
      {
        disabled: true,
        onClick: () => {
          calls += 1;
        },
      },
      'Save',
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  assert.equal(calls, 0);
  render(createElement(UI.Button, { component: 'a', href: '/workspaces' }, 'Workspaces'));
  assert.equal(
    screen.getByRole('link', { name: 'Workspaces' }).getAttribute('href'),
    '/workspaces',
  );
});

test('auth panel and toolbar remain content-driven instead of selecting modes', () => {
  assert.ok(UI.AuthPanel, 'Shared AuthPanel must exist');
  render(
    createElement(
      UI.AuthPanel,
      { description: 'Continue your work', title: 'Sign in' },
      createElement(
        UI.Toolbar.Root,
        null,
        createElement(UI.Toolbar.Group, null, createElement('button', null, 'Password')),
        createElement(UI.Toolbar.Group, null, createElement('button', null, 'Passkey')),
      ),
    ),
  );
  assert.ok(screen.getByRole('main'));
  assert.ok(screen.getByRole('heading', { level: 1, name: 'Sign in' }));
  assert.ok(screen.getByText('Continue your work'));
  assert.ok(screen.getByRole('button', { name: 'Passkey' }));
});

test('the shared theme uses the agreed neutral surfaces in both modes', () => {
  assert.equal(UI.theme.colorSchemes.light.palette.background.default, 'hsl(0, 0%, 98.0392%)');
  assert.equal(UI.theme.colorSchemes.dark.palette.background.default, 'hsl(240, 10%, 3.9216%)');
});
