import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';

import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { ids, task } from './common/board-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

async function openParent(t) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const api = await startAppApi(t);
  api.controls.board.tableMode = true;
  const web = await startWeb(
    t,
    api.origin,
    'localhost',
    process.env.FLOWBOARD_WEB_DEV_TEST === '1',
  );
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(`${web.origin}/login`);
  await page.getByLabel(/^Email/).fill('alice@example.test');
  await page.getByLabel(/^Password/).fill('browser-test-password');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Engineering/ }).click();
  await page.getByRole('button', { exact: true, name: 'Public list' }).click();
  const origin = page.getByRole('button', { exact: true, name: 'Open task: Fix login' });
  await origin.click();

  return { page, api, origin, drawer: page.getByRole('dialog', { name: 'Task details' }) };
}

test('create a child with required values, navigate its saved parent and detach explicitly', async (t) => {
  const { page, drawer } = await openParent(t);
  await drawer.getByRole('button', { exact: true, name: 'Add subtask' }).click();
  await drawer.getByLabel(/^Title/).fill('Child from drawer');
  await drawer.getByRole('button', { exact: true, name: 'Create task' }).click();
  await expect(drawer.getByLabel(/^Area/)).toBeFocused();
  await drawer.getByLabel(/^Area/).selectOption(ids.option);
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/lists\/[^/]+\/tasks$/.test(new URL(response.url()).pathname),
  );
  await drawer.getByRole('button', { exact: true, name: 'Create task' }).click();
  const parentId = (await (await created).json()).data.parentTaskId;
  assert.ok(parentId);
  await expect(drawer.getByText('Task created.', { exact: true })).toBeVisible();
  await drawer.getByRole('button', { exact: true, name: 'Open parent task' }).click();
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Fix login');
  await drawer
    .getByRole('region', { exact: true, name: 'Subtasks' })
    .getByRole('button', { exact: true, name: 'Child from drawer' })
    .click();
  await expect(drawer.getByLabel(/^Parent task/)).toHaveValue(parentId);
  await drawer.getByLabel(/^Parent task/).selectOption({ label: 'No parent (top-level task)' });
  const detached = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      /\/tasks\/[^/]+$/.test(new URL(response.url()).pathname),
  );
  await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
  assert.equal((await (await detached).json()).data.parentTaskId, null);
  await expect(drawer.getByText('Task saved.', { exact: true })).toBeVisible();
  await expect(drawer.getByRole('button', { exact: true, name: 'Add subtask' })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mkdir(new URL('../../../.ai-local/p3002/', import.meta.url), { recursive: true });
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(async () => Math.round((await drawer.boundingBox()).width))
      .toBeLessThanOrEqual(width);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await drawer.getByLabel(/^Parent task/).focus();
    await expect(drawer.getByLabel(/^Parent task/)).toBeFocused();
    await page.screenshot({
      path: new URL(`../../../.ai-local/p3002/subtask-${width}.png`, import.meta.url).pathname,
      fullPage: true,
    });
  }
});

test('later-page parent choices and server errors preserve selection and pending changes', async (t) => {
  const { page, api, drawer } = await openParent(t);
  const parent = drawer.getByLabel(/^Parent task/);
  await expect(parent.getByRole('option', { exact: true, name: 'Archive notes' })).toHaveCount(0);
  await drawer.getByRole('button', { exact: true, name: 'Load more parent choices' }).click();
  await expect(parent.getByRole('option', { exact: true, name: 'Archive notes' })).toBeAttached();
  await parent.selectOption({ label: 'Archive notes' });
  const selected = await parent.inputValue();
  api.controls.board.staleCursorOnce = true;
  await drawer.getByRole('button', { exact: true, name: 'Load more parent choices' }).click();
  await expect(
    parent.getByRole('option', { exact: true, name: 'Selected parent (outside loaded choices)' }),
  ).toBeAttached();
  await expect(parent).toHaveValue(selected);
  api.controls.board.rejectNextWrite = {
    status: 400,
    code: 'INVALID_PARENT',
    message: 'Choose a top-level parent.',
    details: [
      {
        path: ['parentTaskId'],
        code: 'invalid_parent',
        message: 'This parent cannot contain subtasks.',
      },
    ],
  };
  await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
  await expect(parent).toBeFocused();
  await expect(parent).toHaveValue(selected);
  await expect(
    drawer.getByText('This parent cannot contain subtasks.', { exact: true }),
  ).toBeVisible();
  let release;
  api.controls.board.writeGate = new Promise((resolve) => {
    release = resolve;
  });
  t.after(() => release());
  await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
  await expect(drawer.getByRole('button', { exact: true, name: 'Saving…' })).toBeDisabled();
  await expect(drawer.getByRole('button', { exact: true, name: 'Add subtask' })).toBeDisabled();
  const count = api.requests.filter((request) => request.method === 'PATCH').length;
  await drawer.locator('form').evaluate((form) => form.requestSubmit());
  release();
  await expect(drawer.getByText('Task saved.', { exact: true })).toBeVisible();
  assert.equal(api.requests.filter((request) => request.method === 'PATCH').length, count);
  await expect(drawer.getByRole('button', { exact: true, name: 'Open parent task' })).toBeVisible();
  await drawer.getByLabel(/^Title/).fill('Keep my unsaved child');
  await drawer.getByRole('button', { exact: true, name: 'Open parent task' }).click();
  const confirm = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
  await confirm.getByRole('button', { exact: true, name: 'Cancel' }).click();
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Keep my unsaved child');
  await drawer.getByRole('button', { exact: true, name: 'Open parent task' }).click();
  await confirm.getByRole('button', { exact: true, name: 'Discard changes' }).click();
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Archive notes');
  assert.equal(api.requests.filter((request) => request.method === 'PATCH').length, count);
  await drawer.getByRole('button', { exact: true, name: 'Close task' }).click();
  await expect(
    page.getByRole('button', { exact: true, name: 'Open task: Fix login' }),
  ).toBeFocused();
});

test('an incomplete empty child page offers loading more instead of claiming no subtasks', async (t) => {
  const { page, drawer } = await openParent(t);
  await drawer.getByRole('button', { exact: true, name: 'Close task' }).click();
  await page.route('**/api/v1/lists/*/tasks?*', async (route) => {
    const url = new URL(route.request().url());
    const parentTaskId = url.searchParams.get('parentTaskId');
    if (!parentTaskId) return route.continue();

    const next = url.searchParams.has('cursor');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        configVersion: 1,
        dataVersion: 1,
        items: next ? [task(91, ids.todo, 0, { title: 'x'.repeat(500), parentTaskId })] : [],
        pageInfo: { hasNextPage: !next, nextCursor: next ? null : 'child-next' },
      }),
    });
  });
  await page.getByRole('button', { exact: true, name: 'Open task: Fix login' }).click();
  const region = drawer.getByRole('region', { exact: true, name: 'Subtasks' });
  await expect(
    region.getByRole('button', { exact: true, name: 'Load more subtasks' }),
  ).toBeVisible();
  await expect(region.getByText('No subtasks yet.', { exact: true })).toHaveCount(0);
  await region.getByRole('button', { exact: true, name: 'Load more subtasks' }).click();
  await expect(region.getByRole('button', { exact: true, name: 'x'.repeat(500) })).toBeVisible();
  await page.setViewportSize({ height: 1000, width: 320 });
  assert.ok(await drawer.evaluate((element) => element.scrollWidth <= element.clientWidth));
  await expect(region.getByRole('button', { exact: true, name: 'Load more subtasks' })).toHaveCount(
    0,
  );
});
