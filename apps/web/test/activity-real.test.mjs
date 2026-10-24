import test from 'node:test';

import { chromium, expect } from '@playwright/test';

import { startRealApp } from './common/real-app-fixture.mjs';

test(
  'a real status save reaches the worker and drawer feed while later activity preserves a draft',
  { timeout: 120000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const app = await startRealApp(t, { activityWorker: true });
    async function open() {
      const page = await browser.newPage();
      const activityReads = [];
      page.on('response', (response) => {
        if (!new URL(response.url()).pathname.endsWith('/activity')) return;

        void response
          .json()
          .then((body) => {
            activityReads.push({
              status: response.status(),
              count: body.items?.length,
              time: Date.now(),
            });
          })
          .catch(() => undefined);
      });
      await page.goto(`${app.origin}/login`);
      await page.getByLabel(/^Email/).fill('alice@example.com');
      await page.getByLabel(/^Password/).fill('FlowboardDemo123!');
      await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
      await page.getByRole('button', { name: /Flowboard Demo/ }).click();
      await page.getByRole('button', { exact: true, name: 'Product backlog' }).click();
      await page
        .getByRole('button', { exact: true, name: 'Open task: Build demo workflow 1' })
        .click();

      return { page, drawer: page.getByRole('dialog', { name: 'Task details' }), activityReads };
    }
    const { page, drawer, activityReads } = await open();
    const feed = drawer.getByRole('region', { exact: true, name: 'Activity' });
    await expect(feed.getByText('No status changes yet.')).toBeVisible();
    await drawer.getByLabel(/^Status/).selectOption('f1000000-0000-4000-8000-000000000401');
    await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
    await expect(feed.getByRole('listitem')).toHaveCount(1, { timeout: 15000 });
    await expect(feed).toContainText('Alice changed status from To do to In progress');
    await drawer.getByLabel(/^Title/).fill('Preserved activity draft');
    const other = await open();
    await other.drawer.getByLabel(/^Status/).selectOption('f1000000-0000-4000-8000-000000000402');
    await other.drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
    await expect(
      other.drawer
        .getByRole('status', { exact: true, name: '' })
        .filter({ hasText: 'Task saved.' }),
    ).toBeVisible();
    await expect(feed.getByRole('listitem'))
      .toHaveCount(2, { timeout: 15000 })
      .catch(async (error) => {
        t.diagnostic(
          JSON.stringify({
            visibility: await page.evaluate(() => document.visibilityState),
            activityReads,
          }),
        );
        throw error;
      });
    await expect(drawer.getByLabel(/^Title/)).toHaveValue('Preserved activity draft');
    await page.setViewportSize({ height: 900, width: 320 });
    const bounds = () =>
      page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
    const initial = await bounds();
    // The shell switches its MUI media-query layout after the browser resize event.
    await expect
      .poll(async () => {
        const { width, viewport } = await bounds();

        return width <= viewport;
      })
      .toBe(true);
    t.diagnostic(`Responsive layout: ${JSON.stringify({ initial, settled: await bounds() })}`);
  },
);
