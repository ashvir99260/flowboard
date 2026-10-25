import assert from 'node:assert/strict';
import test from 'node:test';

import { SearchPageSchema } from '@flowboard/contracts';
import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

test(
  'workspace header searches, paginates, opens results, switches theme and signs out',
  { timeout: 120000 },
  async (t) => {
    const api = await startAppApi(t);
    const { origin } = await startWeb(t, api.origin, 'localhost', true);
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { height: 1000, width: 1440 } });
    page.on('pageerror', (error) => t.diagnostic(error.message));
    const requests = [];
    await page.route('**/api/v1/search?*', async (route) => {
      const url = new URL(route.request().url());
      requests.push(Object.fromEntries(url.searchParams));
      const q = url.searchParams.get('q');
      if (q === 'failure')
        return route.fulfill({
          status: 503,
          json: {
            error: { code: 'SERVICE_UNAVAILABLE', message: 'Search temporarily unavailable' },
          },
        });

      const more = url.searchParams.has('cursor');
      const items =
        q === 'nothing'
          ? []
          : more
            ? [
                {
                  id: api.publicList.id,
                  type: 'list',
                  title: 'Public list',
                  containerId: api.publicList.parentId,
                  path: ['Product', 'Roadmap'],
                },
              ]
            : [
                {
                  id: '50000000-0000-4000-8000-000000000002',
                  type: 'task',
                  title: 'Review navigation',
                  containerId: api.publicList.id,
                  path: ['Product', 'Roadmap', 'Public list'],
                },
              ];
      await route.fulfill({
        json: SearchPageSchema.parse({
          items,
          configVersion: 1,
          dataVersion: 1,
          pageInfo: {
            hasNextPage: q !== 'nothing' && !more,
            nextCursor: q !== 'nothing' && !more ? 'search-next' : null,
          },
        }),
      });
    });
    await page.goto(`${origin}/login`);
    await page.getByLabel(/^Email/).fill('alice@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.getByRole('button', { name: /Engineering/ }).click();
    await expect(
      page.getByRole('button', { name: 'Account menu for A Alice admin' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { exact: true, name: 'Settings' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await expect(page.locator('html')).toHaveClass(/light/);
    await page.getByRole('button', { exact: true, name: 'Search tasks and lists' }).click();
    const dialog = page.getByRole('dialog', { name: 'Search workspace' });
    await dialog.getByRole('button', { exact: true, name: 'Search' }).click();
    assert.equal(requests.length, 0, 'empty search stays at the form boundary');
    await dialog.getByLabel(/^Search tasks and lists/).fill('release');
    await dialog.getByRole('button', { exact: true, name: 'Search' }).click();
    try {
      await expect(
        dialog.getByRole('button', { name: 'Open task: Review navigation' }),
      ).toBeVisible();
    } catch (error) {
      t.diagnostic(await dialog.innerText());
      t.diagnostic(JSON.stringify(requests));
      throw error;
    }
    await dialog.getByRole('button', { name: 'Load more results' }).click();
    await expect(dialog.getByRole('button', { name: 'Open list: Public list' })).toBeVisible();
    assert.deepEqual(
      requests.map(({ q, cursor }) => [q, cursor ?? null]),
      [
        ['release', null],
        ['release', 'search-next'],
      ],
    );
    await dialog.getByRole('button', { name: 'Open list: Public list' }).click();
    await expect(page.getByRole('heading', { exact: true, name: 'Public list' })).toBeVisible();
    await page.getByRole('button', { exact: true, name: 'Search tasks and lists' }).click();
    await dialog.getByLabel(/^Search tasks and lists/).fill('release');
    await dialog.getByRole('button', { exact: true, name: 'Search' }).click();
    await expect(
      dialog.getByRole('button', { name: 'Open task: Review navigation' }),
    ).toBeVisible();
    const beforeRepeat = requests.length;
    await dialog.getByRole('button', { exact: true, name: 'Search' }).click();
    await expect.poll(() => requests.length).toBeGreaterThan(beforeRepeat);
    await dialog.getByRole('button', { name: 'Open task: Review navigation' }).click();
    await expect(page.getByRole('dialog', { name: 'Task details' })).toBeVisible();
    await page.getByRole('button', { name: 'Close task' }).click();
    await page.getByRole('button', { exact: true, name: 'Search tasks and lists' }).click();
    await expect(dialog.getByRole('button', { name: 'Open task: Review navigation' })).toHaveCount(
      0,
    );
    await dialog.getByLabel(/^Search tasks and lists/).fill('nothing');
    await dialog.getByRole('button', { exact: true, name: 'Search' }).click();
    await expect(dialog.getByText('No results', { exact: true })).toBeVisible();
    await dialog.getByLabel(/^Search tasks and lists/).fill('failure');
    await dialog.getByRole('button', { exact: true, name: 'Search' }).click();
    await expect(dialog.getByRole('alert', { name: 'Search unavailable' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    await page.setViewportSize({ height: 844, width: 390 });
    await expect(
      page.getByRole('button', { exact: true, name: 'Search tasks and lists' }),
    ).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.getByRole('button', { name: 'Account menu for A Alice admin' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in to Flowboard' })).toBeVisible();
    await expect(
      page.getByRole('button', { exact: true, name: 'Search tasks and lists' }),
    ).toHaveCount(0);
  },
);
