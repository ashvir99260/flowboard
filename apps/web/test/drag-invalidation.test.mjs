import assert from 'node:assert/strict';
import test from 'node:test';

import { SocketEvents } from '@flowboard/contracts';
import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

test(
  'list events retain a pending drag but workspace access changes discard it',
  { timeout: 120000 },
  async (t) => {
    const api = await startAppApi(t);
    const { origin } = await startWeb(t, api.origin, 'localhost', true, 'http://localhost:39999');
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { height: 1200, width: 1440 } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let socket;
    let connected = false;
    await page.routeWebSocket(/\/socket\.io\//, (connection) => {
      socket = connection;
      connection.onMessage((message) => {
        if (String(message).startsWith('40')) {
          connection.send('40{"sid":"drag-test-client"}');
          connected = true;
        }
      });
      connection.send(
        '0{"sid":"drag-test","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}',
      );
    });
    await page.goto(`${origin}/login`);
    await page.getByLabel(/^Email/).fill('alice@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.getByRole('button', { name: /Engineering/ }).click();
    await page.getByRole('button', { exact: true, name: 'Public list' }).click();
    await expect.poll(() => connected).toBe(true);

    const board = page.getByRole('region', { exact: true, name: 'Task board' });
    const column = board.getByRole('region', { exact: true, name: 'To do column' });
    const taskId = '50000000-0000-4000-8000-000000000001';
    const card = board.locator(`[data-drag-task="${taskId}"]`);
    await expect(card).toBeVisible();
    const dismiss = page.getByRole('button', { name: 'Dismiss notification' });
    while (await dismiss.isVisible()) {
      await page.keyboard.press('Alt+t');
      await page.keyboard.press('Escape');
    }

    let releaseWrite;
    let releaseReads;
    const writeGate = new Promise((resolve) => {
      releaseWrite = resolve;
    });
    const readGate = new Promise((resolve) => {
      releaseReads = resolve;
    });
    t.after(() => {
      releaseWrite();
      releaseReads();
    });
    let writes = 0;
    await page.route(`**/api/v1/tasks/${taskId}/reorder`, async (route) => {
      writes++;
      await writeGate;
      await route.continue();
    });
    let phase = 'normal';
    let heldReads = 0;
    let resumedReads = 0;
    await page.route('**/api/v1/lists/**', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();

      if (phase === 'forbidden')
        return route.fulfill({
          status: 403,
          json: { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        });

      if (phase === 'held') {
        heldReads++;
        await readGate;
        await route.continue();
        resumedReads++;

        return;
      }

      await route.continue();
    });
    await card.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await expect.poll(() => writes).toBe(1);
    await expect(column.getByRole('heading', { level: 3 }).first()).toHaveText('Review navigation');
    const completion = page.getByRole('status', { name: 'Notification: Task reordered.' });
    await expect(completion).toHaveCount(0);

    phase = 'held';
    socket.send(
      `42${JSON.stringify([
        SocketEvents.invalidate,
        {
          eventId: '10000000-0000-4000-8000-000000000991',
          kind: 'list',
          listId: api.publicList.id,
          self: true,
        },
      ])}`,
    );
    await expect.poll(() => heldReads).toBeGreaterThan(0);
    await expect(card).toBeVisible();
    await expect(column.getByRole('heading', { level: 3 }).first()).toHaveText('Review navigation');
    await expect(completion).toHaveCount(0);

    releaseWrite();
    await expect(completion).toHaveCount(1);
    await expect(card).toBeVisible();
    await expect(column.getByRole('heading', { level: 3 }).first()).toHaveText('Review navigation');

    phase = 'forbidden';
    socket.send(
      `42${JSON.stringify([
        SocketEvents.invalidate,
        {
          eventId: '10000000-0000-4000-8000-000000000992',
          kind: 'workspace',
          self: true,
        },
      ])}`,
    );
    await expect(board).toHaveCount(0);
    await expect(page.getByRole('alert', { exact: true, name: 'Access denied' })).toBeVisible();
    releaseReads();
    await expect.poll(() => resumedReads).toBe(heldReads);
    await expect(board).toHaveCount(0);
    await expect(page.getByRole('alert', { exact: true, name: 'Access denied' })).toBeVisible();
    assert.equal(writes, 1, 'invalidation never retries a confirmed drag');
  },
);
