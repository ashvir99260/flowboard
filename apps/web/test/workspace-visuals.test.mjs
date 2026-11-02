import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';

import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

test('compact workspace and board layouts keep actions separate at narrow widths', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const api = await startAppApi(t);
  const { origin } = await startWeb(t, api.origin);
  const page = await browser.newPage({ viewport: { height: 1000, width: 1440 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const snapshots = new URL('../../../.ai-local/p4003/', import.meta.url);
  await mkdir(snapshots, { recursive: true });
  await page.goto(`${origin}/login`);
  await page.getByLabel(/^Email/).fill('alice@example.test');
  await page.getByLabel(/^Password/).fill('browser-test-password');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Engineering/ }).click();
  const workspace = page.getByRole('region', { exact: true, name: 'Workspace lists board' });
  await expect(
    workspace
      .getByRole('region', { exact: true, name: 'Public list list column' })
      .getByRole('button', { name: 'Open task: Review navigation' }),
  ).toBeVisible();
  await page.screenshot({
    path: new URL('workspace-light.png', snapshots).pathname,
    fullPage: true,
  });
  await page.getByRole('button', { exact: true, name: 'Public list' }).click();
  const board = page.getByRole('region', { exact: true, name: 'Task board' });
  await expect(board.getByRole('button', { name: 'Open task: Review navigation' })).toBeVisible();
  await expect(page.getByRole('button', { exact: true, name: 'Refresh board' })).toBeVisible();
  const heading = board.getByRole('region', { exact: true, name: 'To do column' });
  await expect(heading.getByText('2 loaded tasks')).toBeVisible();
  await page.screenshot({ path: new URL('board-light.png', snapshots).pathname, fullPage: true });
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.screenshot({ path: new URL('board-dark.png', snapshots).pathname, fullPage: true });
  await page.setViewportSize({ height: 900, width: 320 });
  await expect
    .poll(async () => {
      const brand = await page.getByRole('img', { exact: true, name: 'Flowboard' }).boundingBox();
      const action = await page
        .getByRole('button', { exact: true, name: 'New task' })
        .boundingBox();

      return Boolean(brand && action && brand.x + brand.width <= action.x);
    })
    .toBe(true);
  await page.screenshot({ path: new URL('board-narrow.png', snapshots).pathname, fullPage: true });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  assert.equal(await page.getByRole('button', { exact: true, name: 'New task' }).isEnabled(), true);
  const boxes = await page
    .getByRole('banner')
    .locator('button,[role="img"]')
    .evaluateAll((elements) =>
      elements
        .map((element) => element.getBoundingClientRect().toJSON())
        .filter((box) => box.width && box.height),
    );
  for (let a = 0; a < boxes.length; a++)
    for (let b = a + 1; b < boxes.length; b++) {
      const first = boxes[a];
      const second = boxes[b];
      assert.ok(
        first.right <= second.left ||
          second.right <= first.left ||
          first.bottom <= second.top ||
          second.bottom <= first.top,
        'header controls do not overlap with touch targets',
      );
    }
  await page.screenshot({ path: new URL('board-narrow.png', snapshots).pathname, fullPage: true });
  await page.getByRole('button', { name: 'Open task: Review navigation' }).click();
  await expect(page.getByRole('dialog', { name: 'Task details' })).toBeVisible();
});
