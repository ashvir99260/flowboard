import test from 'node:test';

import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

test('a denied later page cannot restore the old table during retry', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const api = await startAppApi(t);
  const { origin } = await startWeb(t, api.origin, 'localhost', true);
  const page = await browser.newPage();
  await page.goto(`${origin}/login`);
  await page.getByLabel(/^Email/).fill('alice@example.test');
  await page.getByLabel(/^Password/).fill('browser-test-password');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Engineering/ }).click();
  await page.getByRole('button', { exact: true, name: 'Public list' }).click();
  await page.getByRole('link', { name: 'List view' }).click();
  await expect(page.getByRole('grid', { name: 'List tasks' })).toBeVisible();
  let retrying = false;
  let held = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/lists/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('cursor')) {
      await route.fulfill({
        status: 403,
        json: { error: { code: 'FORBIDDEN', message: 'Access denied' } },
      });

      return;
    }

    if (retrying) {
      held++;
      await gate;
    }

    await route.continue();
  });
  try {
    await page.getByRole('button', { exact: true, name: 'Load more tasks' }).click();
    await expect(page.getByRole('alert', { name: 'Access denied' })).toBeVisible();
    retrying = true;
    await page.getByRole('button', { name: 'Retry tasks' }).click();
    await expect.poll(() => held).toBeGreaterThan(0);
    await expect(page.getByRole('grid', { name: 'List tasks' })).toHaveCount(0);
  } finally {
    release();
  }
});
