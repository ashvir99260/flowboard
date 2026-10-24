import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';

import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

async function openApp(t) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const api = await startAppApi(t);
  const { origin } = await startWeb(
    t,
    api.origin,
    'localhost',
    process.env.FLOWBOARD_WEB_DEV_TEST === '1',
  );
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${origin}/login`);
  await page.getByLabel(/^Email/).fill('alice@example.test');
  await page.getByLabel(/^Password/).fill('browser-test-password');

  return { page, api, origin };
}

test('successful sign in displays an accessible toast after navigation and dismisses by keyboard', async (t) => {
  const { page } = await openApp(t);
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a workspace' })).toBeVisible();
  const toast = page.getByRole('status', { name: 'Notification: Signed in.' });
  await expect(toast).toBeVisible({ timeout: 3000 });
  assert.equal(await page.getByRole('button', { name: 'Dismiss notification' }).count(), 1);
  await page.keyboard.press('Alt+t');
  await expect(toast).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Dismiss notification' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(toast).toHaveCount(0);
});

test('API errors persist, preserve inline repair state, and remain accessible inside a drawer', async (t) => {
  const { page, api } = await openApp(t);
  api.controls.board.tableMode = true;
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.getByRole('button', { name: /Engineering/ }).click();
  await page.getByRole('button', { exact: true, name: 'Public list' }).click();
  await page.getByRole('button', { exact: true, name: 'Open task: Fix login' }).click();
  const drawer = page.getByRole('dialog', { name: 'Task details' });
  await drawer.getByLabel(/^Title/).fill('Unsaved draft');
  api.controls.board.rejectNextWrite = {
    code: 'VALIDATION_FAILED',
    message: 'Please correct the title.',
    status: 400,
    details: [{ code: 'custom', path: ['title'], message: 'Title is invalid.' }],
  };
  await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
  const notification = page.getByRole('status', {
    name: 'Notification: Please correct the title.',
  });
  await expect(notification).toBeVisible();
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Unsaved draft');
  await expect(drawer.getByRole('alert')).toContainText('Please correct the title.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const screenshots = new URL('../../../.ai-local/p1601/', import.meta.url);
  await mkdir(screenshots, { recursive: true });
  for (const mode of ['light', 'dark']) {
    await page.evaluate((value) => {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(value);
    }, mode);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(
          async () => {
            const bounds = await notification.boundingBox();

            return bounds && bounds.x >= 0 && bounds.x + bounds.width <= width;
          },
          { message: `Toast fits the ${width}px ${mode} viewport` },
        )
        .toBe(true);
      await expect(notification).toBeVisible();
    }
    await page.screenshot({ path: new URL(`${mode}.png`, screenshots).pathname });
  }
  // Errors remain beyond the success timer; dismissing one must not dismiss the drawer.
  await page.waitForTimeout(6200);
  await expect(notification).toBeVisible();
  await page.keyboard.press('Alt+t');
  await expect(notification).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(notification).toHaveCount(0);
  await expect(drawer).toBeVisible();
  await expect(drawer.getByLabel(/^Title/)).toBeFocused();
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Unsaved draft');
  await drawer.getByLabel(/^Title/).fill('Saved draft');
  await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
  await expect(page.getByRole('status', { name: 'Notification: Task saved.' })).toBeVisible();
});

test('local validation and background reads stay quiet, and session changes clear old messages', async (t) => {
  const { page } = await openApp(t);
  await page.getByLabel(/^Password/).fill('wrong-password');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await expect(
    page.getByRole('status', { name: 'Notification: Invalid email or password' }),
  ).toBeVisible();
  await page.getByLabel(/^Password/).fill('browser-test-password');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await expect(page.getByRole('status', { name: 'Notification: Signed in.' })).toBeVisible();
  await expect(
    page.getByRole('status', { name: 'Notification: Invalid email or password' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.getByRole('button', { name: /Engineering/ }).click();
  await page.getByRole('button', { exact: true, name: 'Public list' }).click();
  await expect(page.getByRole('heading', { exact: true, name: 'Public list' })).toBeVisible();
  assert.equal(await page.getByRole('status', { name: /^Notification:/ }).count(), 0);
  await page.getByRole('button', { exact: true, name: 'New task' }).click();
  await page.getByRole('button', { exact: true, name: 'Create task' }).click();
  assert.equal(await page.getByRole('status', { name: /^Notification:/ }).count(), 0);
});

test('an old failed sign-in cannot show an error after another tab signs in', async (t) => {
  const { page, origin } = await openApp(t);
  // Both boot refreshes finish before one login holds the cross-tab Web Lock.
  const other = await page.context().newPage();
  await other.goto(`${origin}/login`);
  await other.getByLabel(/^Email/).fill('bob@example.test');
  await other.getByLabel(/^Password/).fill('browser-test-password');
  let ready;
  let release;
  let otherReady;
  let releaseOther;
  const requested = new Promise((resolve) => {
    ready = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const otherRequested = new Promise((resolve) => {
    otherReady = resolve;
  });
  const otherGate = new Promise((resolve) => {
    releaseOther = resolve;
  });
  t.after(() => {
    release();
    releaseOther();
  });
  await page.route('**/api/v1/auth/login', async (route) => {
    const response = await route.fetch();
    ready();
    await gate;
    await route.fulfill({ response }).catch(() => undefined);
  });
  await other.route('**/api/v1/auth/login', async (route) => {
    const response = await route.fetch();
    otherReady();
    await otherGate;
    await route.fulfill({ response }).catch(() => undefined);
  });
  await page.getByLabel(/^Password/).fill('wrong-password');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await requested;
  const version = await page.evaluate(() => localStorage.getItem('flowboard.session.revision'));
  await other.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('flowboard.session.revision')))
    .not.toBe(version);
  release();
  await otherRequested;
  await expect(
    page.getByRole('alert').filter({ hasText: 'Invalid email or password' }),
  ).toBeVisible();
  // Bob has not accepted his response yet: later session cleanup cannot hide a stale toast.
  await expect(
    page.getByRole('status', { name: 'Notification: Invalid email or password' }),
  ).toHaveCount(0);
  releaseOther();
  await expect(other.getByRole('heading', { name: 'Choose a workspace' })).toBeVisible();
  await expect(
    other.getByRole('status', { name: 'Notification: Invalid email or password' }),
  ).toHaveCount(0);
});
