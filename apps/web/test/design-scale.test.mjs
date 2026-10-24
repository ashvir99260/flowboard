import assert from 'node:assert/strict';
import test from 'node:test';

import { chromium } from '@playwright/test';

import { startUpstream, startWeb } from './common/proxy-fixture.mjs';

test(
  'rem theme retains geometry and scales with the browser default font',
  { timeout: 120000 },
  async (t) => {
    const api = await startUpstream(t, (_request, response) => response.writeHead(500).end());
    const { origin } = await startWeb(t, api, 'localhost', true);
    for (const font of [16, 20]) {
      const browser = await chromium.launch({
        headless: true,
        args: [`--blink-settings=defaultFontSize=${font}`],
      });
      t.after(() => browser.close());
      const page = await browser.newPage({ viewport: { height: 1000, width: 900 } });
      await page.goto(`${origin}/playground`, { timeout: 60000 });
      const button = page.getByRole('button', { name: 'Preview JSON' });
      await button.waitFor();
      const metrics = await button.evaluate((element) => ({
        root: getComputedStyle(document.documentElement).fontSize,
        body: getComputedStyle(document.body).fontSize,
        height: element.getBoundingClientRect().height,
        radius: getComputedStyle(element).borderRadius,
        medium: matchMedia('(min-width:56.25rem)').matches,
      }));
      assert.equal(metrics.root, font === 16 ? '10px' : '12.5px');
      assert.equal(metrics.body, font === 16 ? '14px' : '17.5px');
      assert.equal(metrics.height, font === 16 ? 44 : 55);
      assert.equal(metrics.radius, '6px');
      assert.equal(metrics.medium, font === 16);
      const section = page.getByRole('heading', { name: 'JSON-driven form' }).locator('..');
      assert.equal(
        await section.evaluate((element) => getComputedStyle(element).paddingLeft),
        font === 16 ? '24px' : '30px',
      );
      const columns = await section
        .locator('..')
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
      assert.equal(columns, font === 16 ? 2 : 1);
      await page.setViewportSize({ height: 1000, width: 320 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await browser.close();
    }
  },
);

test(
  'move dialogs retain their document-rem width independently of media units',
  { timeout: 120000 },
  async (t) => {
    const { startAppApi } = await import('./common/app-api-fixture.mjs');
    const api = await startAppApi(t);
    const { origin } = await startWeb(t, api.origin, 'localhost', true);
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { height: 1000, width: 1440 } });
    await page.goto(`${origin}/login`, { timeout: 60000 });
    await page.getByLabel(/^Email/).fill('alice@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.getByRole('button', { name: /Engineering/ }).click();
    await page.getByRole('button', { exact: true, name: 'Public list' }).click();
    await page
      .getByRole('button', { name: /^Move task/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: 'Move task' });
    await dialog.waitFor();
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && Math.abs((await dialog.boundingBox()).width - 600) > 1)
      await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(Math.round((await dialog.boundingBox()).width), 600);
    await page.setViewportSize({ height: 800, width: 320 });
    assert.ok((await dialog.boundingBox()).width <= 256);
  },
);
