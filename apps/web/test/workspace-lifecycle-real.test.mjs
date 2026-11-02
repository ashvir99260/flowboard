import assert from 'node:assert/strict';
import test from 'node:test';

import { chromium } from '@playwright/test';

import { startRealApp } from './common/real-app-fixture.mjs';

test(
  'real clients drop an archived workspace and can reopen it after administrator recovery',
  { timeout: 120000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const { origin } = await startRealApp(t, { realtime: true });
    const first = await browser.newContext();
    const second = await browser.newContext();
    const alice = await first.newPage();
    const other = await second.newPage();
    const failures = [];
    for (const page of [alice, other]) {
      page.setDefaultTimeout(15000);
      page.on('pageerror', (error) => failures.push(error.message));
      await page.goto(`${origin}/login`);
      await page.getByLabel(/^Email/).fill('alice@example.com');
      await page.getByLabel(/^Password/).fill('FlowboardDemo123!');
      await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
      await page.getByRole('button', { name: /Flowboard Demo/ }).click();
      await page.getByRole('button', { exact: true, name: 'Product backlog' }).click();
      await page.getByRole('region', { exact: true, name: 'Task board' }).waitFor();
    }
    await other
      .getByRole('button', { exact: true, name: 'Open task: Build demo workflow 1' })
      .click();
    await other.getByLabel(/^Title/).fill('Unsaved draft');
    await alice.getByRole('link', { exact: true, name: 'Workspace settings' }).click();
    await alice.getByRole('button', { exact: true, name: 'Archive workspace' }).click();
    await alice
      .getByRole('dialog', { name: 'Archive this workspace?' })
      .getByRole('button', { exact: true, name: 'Archive workspace' })
      .click();
    await alice.getByRole('button', { exact: true, name: 'Restore Flowboard Demo' }).waitFor();
    await other.getByRole('alert', { name: 'Workspace archived' }).waitFor();
    assert.equal(await other.getByRole('dialog', { name: 'Task details' }).count(), 0);
    assert.equal(await other.getByRole('region', { exact: true, name: 'Task board' }).count(), 0);
    await alice.getByRole('button', { exact: true, name: 'Restore Flowboard Demo' }).click();
    await alice.getByRole('navigation', { name: 'Workspace navigation' }).waitFor();
    await other.getByRole('link', { exact: true, name: 'Choose workspace' }).click();
    await other.getByRole('button', { name: /Flowboard Demo/ }).click();
    await other.getByRole('button', { exact: true, name: 'Product backlog' }).waitFor();
    const third = await browser.newContext();
    const arriving = await third.newPage();
    arriving.setDefaultTimeout(15000);
    arriving.on('pageerror', (error) => failures.push(error.message));
    let release;
    let received;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    const reached = new Promise((resolve) => {
      received = resolve;
    });
    await arriving.route('**/api/v1/auth/login', async (route) => {
      const response = await route.fetch();
      received();
      await held;
      await route.fulfill({ response });
    });
    await arriving.goto(`${origin}/login`);
    await arriving.getByLabel(/^Email/).fill('alice@example.com');
    await arriving.getByLabel(/^Password/).fill('FlowboardDemo123!');
    await arriving.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await reached;
    await alice.getByRole('link', { exact: true, name: 'Workspace settings' }).click();
    await alice.getByRole('button', { exact: true, name: 'Archive workspace' }).click();
    await alice
      .getByRole('dialog', { name: 'Archive this workspace?' })
      .getByRole('button', { exact: true, name: 'Archive workspace' })
      .click();
    await alice.getByRole('button', { exact: true, name: 'Restore Flowboard Demo' }).waitFor();
    const refreshed = arriving.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/auth/refresh' && response.status() === 200,
    );
    release();
    await refreshed;
    await arriving.getByRole('button', { exact: true, name: 'Restore Flowboard Demo' }).waitFor();
    assert.equal(
      await arriving.getByRole('region', { exact: true, name: 'Task board' }).count(),
      0,
    );
    assert.deepEqual(failures, []);
  },
);
