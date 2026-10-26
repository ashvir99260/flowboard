import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';

import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

test('initial board, list and drawer loads use stable accessible skeletons', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const api = await startAppApi(t);
  const { origin } = await startWeb(t, api.origin);
  const page = await browser.newPage({ viewport: { height: 1000, width: 1440 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${origin}/login`);
  await page.getByLabel(/^Email/).fill('alice@example.test');
  await page.getByLabel(/^Password/).fill('browser-test-password');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Engineering/ }).click();
  await expect(
    page.getByRole('region', { exact: true, name: 'Workspace lists board' }),
  ).toBeVisible();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  api.controls.board.publicGate = gate;
  const snapshots = new URL('../../../.ai-local/p4002/', import.meta.url);
  await mkdir(snapshots, { recursive: true });
  try {
    await page.getByRole('button', { exact: true, name: 'Public list' }).click();
    const loading = page.getByRole('status', { name: 'Loading board…' });
    await expect(loading).toHaveCount(1);
    const skeletons = page.locator('.MuiSkeleton-root');
    assert.ok((await skeletons.count()) >= 12);
    await expect(skeletons.first()).toHaveCSS('animation-name', 'none');
    const region = loading.locator('..');
    assert.ok((await region.boundingBox()).height > 300);
    assert.equal(await region.locator('button,input,a').count(), 0);
    await page.screenshot({ path: new URL('board-light.png', snapshots).pathname, fullPage: true });
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await page.screenshot({ path: new URL('board-dark.png', snapshots).pathname, fullPage: true });
    await page.setViewportSize({ height: 900, width: 320 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({
      path: new URL('board-narrow.png', snapshots).pathname,
      fullPage: true,
    });
  } finally {
    release();
    api.controls.board.publicGate = null;
  }
  await page.setViewportSize({ height: 1000, width: 1440 });
  await expect(page.getByRole('button', { name: 'Open task: Review navigation' })).toBeVisible();

  let releaseTable;
  api.controls.board.publicGate = new Promise((resolve) => {
    releaseTable = resolve;
  });
  let tableHeight;
  try {
    await page.getByRole('link', { name: 'List view' }).click();
    await expect(page.getByRole('status', { name: 'Loading tasks…' })).toHaveCount(1);
    await expect(page.getByRole('grid', { name: 'List tasks' })).toHaveCount(0);
    tableHeight = (
      await page.getByRole('status', { name: 'Loading tasks…' }).locator('..').boundingBox()
    ).height;
    await page.screenshot({ path: new URL('table.png', snapshots).pathname, fullPage: true });
  } finally {
    releaseTable();
    api.controls.board.publicGate = null;
  }
  await expect(page.getByRole('grid', { name: 'List tasks' })).toBeVisible();
  const gridHeight = (
    await page.getByRole('region', { name: 'Scrollable task list' }).boundingBox()
  ).height;
  assert.ok(Math.abs(tableHeight - gridHeight) < 3, 'table loading reserves the final grid height');

  let releaseTask;
  const taskGate = new Promise((resolve) => {
    releaseTask = resolve;
  });
  await page.route('**/api/v1/tasks/*', async (route) => {
    if (route.request().method() === 'GET') await taskGate;

    await route.continue();
  });
  try {
    await page.getByRole('button', { name: 'Open task: Review navigation' }).click();
    const drawer = page.getByRole('dialog', { name: 'Task details' });
    await expect(drawer.getByRole('status', { name: 'Loading task…' })).toHaveCount(1);
    assert.equal(await drawer.locator('input,textarea').count(), 0);
    await page.screenshot({ path: new URL('drawer.png', snapshots).pathname, fullPage: true });
  } finally {
    releaseTask();
  }
  await expect(
    page.getByRole('dialog', { name: 'Task details' }).getByLabel(/^Title/),
  ).toBeVisible();
});
