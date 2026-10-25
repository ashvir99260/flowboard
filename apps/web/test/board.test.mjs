import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';

import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { ids } from './common/board-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

async function openBoard(t, configure = () => {}) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const api = await startAppApi(t);
  configure(api.controls.board);
  const { origin } = await startWeb(t, api.origin);
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(`${origin}/login`);
  await page.getByLabel(/^Email/).fill('alice@example.test');
  await page.getByLabel(/^Password/).fill('browser-test-password');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Engineering/ }).click();
  await page.getByRole('button', { exact: true, name: 'Public list' }).click();

  return { page, api, origin };
}

test(
  'boards render exact sibling columns, card metadata, empty columns and per-column pagination',
  { timeout: 120000 },
  async (t) => {
    const { page, api } = await openBoard(t);
    const board = page.getByRole('region', { exact: true, name: 'Task board' });
    await board.waitFor();
    const todo = board.getByRole('region', { exact: true, name: 'To do column' });
    assert.equal(await todo.getByRole('article').count(), 2);
    assert.equal(await todo.getByRole('heading', { level: 3 }).count(), 2);
    await todo.getByText('Urgent', { exact: true }).waitFor();
    await todo.getByText('Effort: 0', { exact: true }).first().waitFor();
    await todo.getByText(/2026-11-01 00:00:00 UTC/).waitFor();
    await todo.getByLabel('Alice').waitFor();
    assert.equal(
      await board.getByRole('region', { name: 'Done column' }).getByRole('article').count(),
      0,
    );
    await todo.getByRole('button', { name: 'Load more To do tasks' }).click();
    await todo.getByRole('heading', { name: 'Next page task' }).waitFor();
    assert.equal(await todo.getByRole('article').count(), 3);
    await page.evaluate(() => {
      const now = Date.now;
      Date.now = () => now() + 16000;
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      window.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      window.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(todo.getByRole('article')).toHaveCount(2);
    assert.ok(
      api.requests
        .filter((request) => request.path.endsWith('/tasks'))
        .every((request) => request.query.statusId),
    );
    await page.getByRole('button', { exact: true, name: 'Private list' }).click();
    await board.getByRole('region', { exact: true, name: 'Released column' }).waitFor();
    assert.equal(await board.getByRole('region', { exact: true, name: 'To do column' }).count(), 0);
    await board.getByRole('heading', { name: 'Private board task' }).waitFor();
    await page.goBack();
    await board.getByRole('region', { exact: true, name: 'To do column' }).waitFor();
  },
);

test(
  'board snapshots restart together on version drift and stale cursors with bounded recovery',
  { timeout: 120000 },
  async (t) => {
    const { page, api } = await openBoard(t, (controls) => {
      controls.driftRounds = 1;
    });
    const board = page.getByRole('region', { exact: true, name: 'Task board' });
    await board.waitFor();
    const doneCalls = () =>
      api.requests.filter(
        (request) => request.path.endsWith('/tasks') && request.query.statusId === ids.done,
      ).length;
    assert.equal(doneCalls(), 2);
    api.controls.board.staleCursorOnce = true;
    const staleResponse = page.waitForResponse(
      (response) => response.url().includes('/tasks?') && response.status() === 409,
    );
    await board.getByRole('button', { name: 'Load more To do tasks' }).click();
    await staleResponse;
    await expect.poll(doneCalls).toBe(3);
    await board.getByRole('button', { name: 'Load more To do tasks' }).waitFor();
    assert.equal(await board.getByRole('heading', { name: 'Next page task' }).count(), 0);
    assert.equal(doneCalls(), 3);
    api.controls.board.driftRounds = Infinity;
    await page.reload();
    await page.getByRole('alert', { name: 'Board changed while loading' }).waitFor();
    assert.equal(await board.count(), 0);
    assert.equal(doneCalls(), 6);
    api.controls.board.driftRounds = 0;
    await page.getByRole('button', { name: 'Retry board' }).click();
    await board.waitFor();
    api.controls.board.malformed = true;
    await page.reload();
    await page.getByRole('alert', { name: 'Board data unavailable' }).waitFor();
    assert.equal(await board.count(), 0);
  },
);

test(
  'empty, denied and delayed old-list states stay isolated and the board scrolls within small screens',
  { timeout: 120000 },
  async (t) => {
    const { page, api } = await openBoard(t, (controls) => {
      controls.empty = true;
    });
    const board = page.getByRole('region', { exact: true, name: 'Task board' });
    await board.waitFor();
    assert.equal(await board.getByRole('article').count(), 0);
    assert.equal(await board.getByText('No tasks', { exact: true }).count(), 3);
    api.controls.board.error = 'FORBIDDEN';
    await page.reload();
    await page.getByRole('alert', { name: 'Access denied' }).waitFor();
    assert.equal(await board.count(), 0);
    api.controls.board.error = null;
    api.controls.board.empty = false;
    let release;
    api.controls.board.publicGate = new Promise((resolve) => {
      release = resolve;
    });
    t.after(() => release());
    await page.reload();
    await page.getByRole('button', { exact: true, name: 'Private list' }).click();
    await board.getByRole('heading', { name: 'Private board task' }).waitFor();
    release();
    api.controls.board.publicGate = null;
    assert.equal(await board.getByRole('region', { exact: true, name: 'To do column' }).count(), 0);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await mkdir(new URL('../../../.ai-local/p0901/', import.meta.url), { recursive: true });
      await page.screenshot({
        path: new URL(`../../../.ai-local/p0901/board-${width}.png`, import.meta.url).pathname,
        fullPage: true,
      });
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      );
    }
  },
);
