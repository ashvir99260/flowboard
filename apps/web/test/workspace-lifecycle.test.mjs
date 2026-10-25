import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';

import { chromium } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

test('workspace administrator can open lifecycle settings', { timeout: 120000 }, async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const api = await startAppApi(t);
  const { origin } = await startWeb(t, api.origin);
  const page = await browser.newPage();
  page.setDefaultTimeout(2500);
  await page.goto(`${origin}/login`);
  await page.getByLabel(/^Email/).fill('alice@example.test');
  await page.getByLabel(/^Password/).fill('browser-test-password');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Engineering/ }).click();
  await page.getByRole('link', { exact: true, name: 'Workspace settings' }).waitFor();
  assert.equal(
    await page.getByRole('link', { exact: true, name: 'Workspace settings' }).count(),
    1,
  );
  await page.getByRole('link', { exact: true, name: 'Workspace settings' }).click();
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByLabel(/^Workspace name/).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  }
  const folder = new URL('../../../.ai-local/p2902/', import.meta.url);
  await mkdir(folder, { recursive: true });
  await page.screenshot({
    path: new URL('workspace-settings.png', folder).pathname,
    fullPage: true,
  });
});

test(
  'workspace rename, archive confirmation and restore keep navigation usable',
  { timeout: 120000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startAppApi(t);
    const { origin } = await startWeb(t, api.origin);
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(`${origin}/login`);
    await page.getByLabel(/^Email/).fill('alice@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.getByRole('button', { name: /Engineering/ }).click();
    await page.getByRole('link', { exact: true, name: 'Workspace settings' }).click();
    await page.getByLabel(/^Workspace name/).fill('Operations');
    await page.getByRole('button', { exact: true, name: 'Save workspace' }).click();
    await page
      .getByRole('link', { name: /Switch workspace$/ })
      .getByText('Operations', { exact: true })
      .waitFor();
    await page.getByRole('button', { exact: true, name: 'Archive workspace' }).click();
    await page
      .getByRole('dialog', { name: 'Archive this workspace?' })
      .getByRole('button', { name: 'Cancel' })
      .click();
    assert.equal(api.requests.filter((entry) => entry.path.endsWith('/archive')).length, 0);
    await page.getByRole('button', { exact: true, name: 'Archive workspace' }).click();
    await page
      .getByRole('dialog', { name: 'Archive this workspace?' })
      .getByRole('button', { exact: true, name: 'Archive workspace' })
      .click();
    await page.getByRole('heading', { name: 'Choose a workspace' }).waitFor();
    await page.getByRole('button', { exact: true, name: 'Restore Operations' }).click();
    await page.getByRole('navigation', { name: 'Workspace navigation' }).waitFor();
    await page
      .getByRole('link', { name: /Switch workspace$/ })
      .getByText('Operations', { exact: true })
      .waitFor();
    assert.equal(api.workspace.archivedAt, null);
  },
);

test(
  'stale workspace edits retain the draft and require explicit reload',
  { timeout: 120000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startAppApi(t);
    const { origin } = await startWeb(t, api.origin);
    const page = await browser.newPage();
    await page.goto(`${origin}/login`);
    await page.getByLabel(/^Email/).fill('alice@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.getByRole('button', { name: /Engineering/ }).click();
    await page.getByRole('link', { exact: true, name: 'Workspace settings' }).click();
    await page.getByLabel(/^Workspace name/).fill('My retained draft');
    api.controls.lifecycleConflict = true;
    await page.getByRole('button', { exact: true, name: 'Save workspace' }).click();
    await page
      .getByRole('alert')
      .filter({ hasText: 'Workspace configuration changed' })
      .first()
      .waitFor();
    assert.equal(await page.getByLabel(/^Workspace name/).inputValue(), 'My retained draft');
    assert.equal(
      await page.getByRole('button', { exact: true, name: 'Save workspace' }).isDisabled(),
      true,
    );
    api.controls.lifecycleConflict = false;
    await page.getByRole('button', { exact: true, name: 'Reload workspace' }).click();
    await page
      .getByRole('dialog', { name: 'Discard unsaved changes?' })
      .getByRole('button', { name: 'Discard and reload' })
      .click();
    await page.waitForFunction(
      () => document.querySelector('input[name="name"]')?.value === 'Engineering',
    );
    assert.equal(
      await page.getByRole('button', { exact: true, name: 'Save workspace' }).isEnabled(),
      true,
    );
  },
);

test(
  'explicit reload disables edits until it settles and preserves the draft after a failed read',
  { timeout: 120000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startAppApi(t);
    const { origin } = await startWeb(t, api.origin);
    const page = await browser.newPage();
    await page.goto(`${origin}/login`);
    await page.getByLabel(/^Email/).fill('alice@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.getByRole('button', { name: /Engineering/ }).click();
    await page.getByRole('link', { exact: true, name: 'Workspace settings' }).click();
    await page.getByLabel(/^Workspace name/).fill('Keep until reload succeeds');
    let release;
    t.after(() => release?.());
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    await page.route(`**/v1/workspaces/${api.workspace.id}`, async (route) => {
      await pending;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Try again later' },
        }),
      });
    });
    await page.getByRole('button', { exact: true, name: 'Reload workspace' }).click();
    await page
      .getByRole('dialog', { name: 'Discard unsaved changes?' })
      .getByRole('button', { name: 'Discard and reload' })
      .click();
    await page.waitForFunction(
      () => document.querySelector('input[name="name"]')?.disabled === true,
    );
    assert.equal(
      await page.getByRole('button', { exact: true, name: 'Save workspace' }).isDisabled(),
      true,
    );
    release();
    await page
      .getByRole('alert')
      .filter({ hasText: 'Workspace details could not refresh' })
      .waitFor();
    await page.waitForFunction(
      () => document.querySelector('input[name="name"]')?.disabled === false,
    );
    assert.equal(
      await page.getByLabel(/^Workspace name/).inputValue(),
      'Keep until reload succeeds',
    );
  },
);

test(
  'member direct routes deny workspace management and pending submissions stay singular',
  { timeout: 120000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startAppApi(t);
    const { origin } = await startWeb(t, api.origin);
    const page = await browser.newPage();
    await page.goto(`${origin}/login`);
    await page.getByLabel(/^Email/).fill('bob@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.getByRole('button', { name: /Engineering/ }).click();
    assert.equal(
      await page.getByRole('link', { exact: true, name: 'Workspace settings' }).count(),
      0,
    );
    await page.goto(`${origin}/w/${api.workspace.id}/settings/workspace`);
    await page.getByRole('alert', { name: 'Access denied' }).waitFor();
    await page.getByRole('button', { name: /^Account menu for / }).click();
    await page.getByRole('menuitem', { exact: true, name: 'Sign out' }).click();
    await page.getByLabel(/^Email/).fill('alice@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.getByRole('button', { name: /Engineering/ }).click();
    await page.getByRole('link', { exact: true, name: 'Workspace settings' }).click();
    await page.getByLabel(/^Workspace name/).fill('One submission');
    let release;
    api.controls.lifecycleGate = new Promise((resolve) => {
      release = resolve;
    });
    await page.getByLabel(/^Workspace name/).press('Enter');
    await page.waitForFunction(
      () =>
        document
          .querySelector('form[aria-label="Workspace settings"]')
          ?.getAttribute('aria-busy') === 'true',
    );
    assert.equal(
      await page.getByRole('button', { exact: true, name: 'Save workspace' }).isDisabled(),
      true,
    );
    assert.equal(api.requests.filter((entry) => entry.method === 'PATCH').length, 1);
    release();
    await page
      .getByRole('link', { name: /Switch workspace$/ })
      .getByText('One submission', { exact: true })
      .waitFor();
  },
);

test(
  'restore conflicts can reload their revision and a fresh null selection can recover',
  { timeout: 120000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startAppApi(t);
    const { origin } = await startWeb(t, api.origin);
    const page = await browser.newPage();
    await page.goto(`${origin}/login`);
    await page.getByLabel(/^Email/).fill('alice@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.getByRole('button', { name: /Engineering/ }).click();
    await page.getByRole('link', { exact: true, name: 'Workspace settings' }).click();
    await page.getByRole('button', { exact: true, name: 'Archive workspace' }).click();
    await page
      .getByRole('dialog', { name: 'Archive this workspace?' })
      .getByRole('button', { exact: true, name: 'Archive workspace' })
      .click();
    await page.getByRole('button', { exact: true, name: 'Restore Engineering' }).waitFor();
    await page.getByRole('button', { exact: true, name: 'Sign out' }).click();
    await page.getByLabel(/^Email/).fill('alice@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.getByRole('button', { exact: true, name: 'Restore Engineering' }).waitFor();
    api.controls.lifecycle.configVersion++;
    await page.getByRole('button', { exact: true, name: 'Restore Engineering' }).click();
    await page.getByRole('button', { exact: true, name: 'Reload workspaces' }).click();
    await page.getByRole('button', { exact: true, name: 'Restore Engineering' }).click();
    await page.getByRole('navigation', { name: 'Workspace navigation' }).waitFor();
    assert.equal(api.workspace.archivedAt, null);
  },
);
