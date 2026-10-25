import assert from 'node:assert/strict';
import test from 'node:test';

import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

for (const view of ['list', 'workspace'])
  test(
    `${view} drag keeps its placement and board mounted through save and refresh`,
    { timeout: 120000 },
    async (t) => {
      const api = await startAppApi(t);
      const { origin } = await startWeb(t, api.origin, 'localhost', true);
      const browser = await chromium.launch({ headless: true });
      t.after(() => browser.close());
      const page = await browser.newPage({ viewport: { height: 1200, width: 1440 } });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`${origin}/login`);
      await page.getByLabel(/^Email/).fill('alice@example.test');
      await page.getByLabel(/^Password/).fill('browser-test-password');
      await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
      if (await page.getByRole('button', { name: 'Dismiss notification' }).isVisible()) {
        await page.keyboard.press('Alt+t');
        await page.keyboard.press('Escape');
      }

      await page.getByRole('button', { name: /Engineering/ }).click();
      if (view === 'list')
        await page.getByRole('button', { exact: true, name: 'Public list' }).click();

      const boardLabel = view === 'list' ? 'Task board' : 'Workspace lists board';
      const board = page.getByRole('region', { name: boardLabel, exact: true });
      const taskId = '50000000-0000-4000-8000-000000000001';
      const card = board.locator(`[data-drag-task="${taskId}"]`);
      await expect(card).toBeVisible();
      if (await page.getByRole('button', { name: 'Dismiss notification' }).isVisible()) {
        await page.keyboard.press('Alt+t');
        await page.keyboard.press('Escape');
      }

      const initialTop = (await board.boundingBox()).y;
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
      api.controls.board.moveGates.set(taskId, writeGate);
      let holdReads = false;
      let held = 0;
      await page.route('**/api/v1/lists/**', async (route) => {
        if (holdReads && route.request().method() === 'GET') {
          held++;
          await readGate;
        }

        await route.continue();
      });
      await card.focus();
      await page.keyboard.press('Space');
      await page.keyboard.press(view === 'list' ? 'ArrowDown' : 'ArrowRight');
      await page.keyboard.press('Space');
      await expect(card).toHaveAttribute('aria-disabled', 'true');
      assert.equal(
        (await board.boundingBox()).y,
        initialTop,
        'saving feedback must not move the board',
      );
      await expect(
        page.getByRole('status', { name: /^Notification: Task (moved|reordered)\./ }),
      ).toHaveCount(0);
      await page.evaluate((label) => {
        const root = document.querySelector(`[aria-label="${label}"]`);
        window.boardWasRemoved = false;
        window.boardObserver = new MutationObserver(() => {
          if (!root.isConnected) window.boardWasRemoved = true;
        });
        window.boardObserver.observe(document.body, { childList: true, subtree: true });
      }, boardLabel);
      holdReads = true;
      releaseWrite();
      await expect.poll(() => held).toBeGreaterThan(0);
      await expect(card).toBeVisible();
      const target =
        view === 'list'
          ? board.getByRole('region', { exact: true, name: 'To do column' })
          : board.getByRole('region', { exact: true, name: 'Private list list column' });
      await expect(target.locator(`[data-drag-task="${taskId}"]`)).toBeVisible();
      const toast = page.getByRole('status', {
        name: `Notification: Task ${view === 'list' ? 'reordered' : 'moved'}.`,
      });
      await expect(toast).toHaveCount(1);
      await expect(toast.locator('.Toastify__progress-bar--animated')).toHaveCSS(
        'animation-duration',
        '6s',
      );
      assert.equal(await page.evaluate(() => window.boardWasRemoved), false);
      releaseReads();
      await expect(card).toHaveAttribute('aria-disabled', 'false');
      assert.equal(await page.evaluate(() => window.boardWasRemoved), false);
      assert.equal((await board.boundingBox()).y, initialTop);
      if (view === 'list')
        await expect(target.getByRole('heading', { level: 3 }).first()).toHaveText(
          'Review navigation',
        );

      await page.evaluate(() => window.boardObserver.disconnect());
    },
  );
