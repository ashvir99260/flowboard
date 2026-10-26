import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';

import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

for (const view of ['board', 'list', 'workspace'])
  test(`${view} keeps existing content mounted during a focus refresh`, async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startAppApi(t);
    const { origin } = await startWeb(t, api.origin, 'localhost', true);
    const page = await browser.newPage({ viewport: { height: 1000, width: 1440 } });
    await page.goto(`${origin}/login`);
    await page.getByLabel(/^Email/).fill('alice@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.getByRole('button', { name: /Engineering/ }).click();
    if (view !== 'workspace') {
      await page.getByRole('button', { exact: true, name: 'Public list' }).click();
      if (view === 'list') await page.getByRole('link', { name: 'List view' }).click();
    }

    const content =
      view === 'list'
        ? page.getByRole('grid', { name: 'List tasks' })
        : page.getByRole('region', {
            exact: true,
            name: view === 'board' ? 'Task board' : 'Workspace lists board',
          });
    const task = (
      view === 'workspace'
        ? content.getByRole('region', { exact: true, name: 'Public list list column' })
        : content
    ).getByRole('button', { name: 'Open task: Review navigation' });
    await expect(task).toBeVisible();
    const snapshots = new URL('../../../.ai-local/p4001/', import.meta.url);
    await mkdir(snapshots, { recursive: true });
    await page.screenshot({ path: new URL(`${view}.png`, snapshots).pathname, fullPage: true });
    const busyRoot =
      view === 'list' ? page.getByRole('region', { exact: true, name: 'List view' }) : content;
    await expect(busyRoot).toHaveAttribute('aria-busy', 'false');
    const statusReads = () =>
      api.requests.filter(
        (request) =>
          request.path === '/v1/lists/20000000-0000-4000-8000-000000000013/resolved-statuses',
      ).length;
    const initialReads = statusReads();
    const marker = await content.elementHandle();
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    let held = 0;
    await page.route('**/api/v1/lists/**', async (route) => {
      if (route.request().method() === 'GET') {
        held++;
        await gate;
      }

      await route.continue();
    });
    try {
      await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
      await expect.poll(() => held).toBeGreaterThan(0);
      await expect(busyRoot).toHaveAttribute('aria-busy', 'true');
      await page.evaluate(() => {
        for (let index = 0; index < 6; index++) window.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(task).toBeVisible();
      assert.equal(await marker.evaluate((element) => element.isConnected), true);
    } finally {
      release();
    }
    await expect.poll(() => statusReads() - initialReads).toBe(2);
    await expect(busyRoot).toHaveAttribute('aria-busy', 'false');
    await expect(task).toBeVisible();
  });
