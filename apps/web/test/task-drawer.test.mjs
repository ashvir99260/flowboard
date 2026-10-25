import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';

import { AuthExamples } from '@flowboard/contracts';
import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { ids } from './common/board-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';
import { selectAutocomplete } from './common/selectAutocomplete.mjs';
import { mobileOption } from './common/table-fixture.mjs';

async function openTask(t, extraFields = false, timezoneId = 'UTC') {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const api = await startAppApi(t);
  api.controls.board.tableMode = true;
  api.controls.board.extraFields = extraFields;
  const web = await startWeb(
    t,
    api.origin,
    'localhost',
    process.env.FLOWBOARD_WEB_DEV_TEST === '1',
  );
  const page = await browser.newPage({ timezoneId });
  page.setDefaultTimeout(8000);
  await page.goto(`${web.origin}/login`);
  await page.getByLabel(/^Email/).fill('alice@example.test');
  await page.getByLabel(/^Password/).fill('browser-test-password');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Engineering/ }).click();
  await page.getByRole('button', { exact: true, name: 'Public list' }).click();
  const button = page.getByRole('button', { exact: true, name: 'Open task: Fix login' });
  await button.click();

  return { page, api, button, drawer: page.getByRole('dialog', { name: 'Task details' }) };
}

test('task drawer loads authoritative built-ins and resolved fields and returns focus on close', async (t) => {
  const { page, api, button, drawer } = await openTask(t);
  await expect(drawer.getByLabel(/^Title/))
    .toHaveValue('Fix login')
    .catch(async (cause) => {
      throw new Error(
        `Drawer state: ${await drawer.textContent()}; requests: ${JSON.stringify(api.requests.map(({ path, query }) => ({ path, query })))}`,
        { cause },
      );
    });
  await expect(drawer.getByLabel(/^Effort/)).toHaveValue('5');
  await expect(drawer.getByLabel(/^Approved/)).toBeChecked();
  await expect(drawer.getByText('Inherited', { exact: true })).toHaveCount(3);
  assert.ok(
    api.requests.some((entry) => /\/tasks\/[^/]+$/.test(entry.path) && entry.method === 'GET'),
  );
  await drawer.getByRole('button', { exact: true, name: 'Close task' }).click();
  await expect(drawer).toHaveCount(0);
  await expect(button).toBeFocused();
  await page.getByRole('link', { exact: true, name: 'List' }).click();
  await page.getByRole('button', { exact: true, name: 'Open task: Fix login' }).click();
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Fix login');
});

test('saving task fields persists, refreshes the board and resets the dirty baseline', async (t) => {
  const { page, api, drawer } = await openTask(t);
  const save = drawer.getByRole('button', { exact: true, name: 'Save changes' });
  await expect(save).toBeVisible();
  await drawer.getByLabel(/^Title/).fill('Fixed login');
  await drawer.getByLabel(/^Effort/).fill('0');
  await drawer.getByLabel(/^Approved/).uncheck();
  await save.click();
  await expect(drawer.getByRole('status', { exact: true, name: '' })).toContainText('Task saved');
  const request = api.requests.find(
    (item) => item.method === 'PATCH' && item.path.includes('/tasks/'),
  );
  assert.deepEqual(request.body, {
    title: 'Fixed login',
    customFields: { approved: false, effort: 0 },
    expectedVersion: 1,
    expectedConfigVersion: 1,
  });
  await drawer.getByRole('button', { exact: true, name: 'Close task' }).click();
  await expect(drawer).toHaveCount(0);
  await expect(
    page.getByRole('button', { exact: true, name: 'Open task: Fixed login' }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { exact: true, name: 'Open task: Fixed login' }).click();
  await expect(drawer.getByLabel(/^Effort/)).toHaveValue('0');
  await expect(drawer.getByLabel(/^Approved/)).not.toBeChecked();
});

test('same-workspace Back navigation keeps a dirty drawer and closing asks before discarding', async (t) => {
  const { page, drawer } = await openTask(t);
  await drawer.getByLabel(/^Title/).fill('Unfinished edit');
  await page.goBack();
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Unfinished edit');
  await drawer.getByRole('button', { exact: true, name: 'Close task' }).click();
  const confirm = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { exact: true, name: 'Cancel' }).click();
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Unfinished edit');
  await page.keyboard.press('Escape');
  await confirm.getByRole('button', { exact: true, name: 'Discard changes' }).click();
  await expect(drawer).toHaveCount(0);
});

test('create validates required fields and stores explicit zero and false values', async (t) => {
  const { page, api, drawer } = await openTask(t);
  await drawer.getByRole('button', { exact: true, name: 'Close task' }).click();
  await page.getByRole('button', { exact: true, name: 'New task' }).click();
  await drawer.getByLabel(/^Title/).fill('Created in drawer');
  await selectAutocomplete(drawer.getByRole('combobox', { name: /^Assignees/ }), 'Alice');
  await drawer.getByRole('button', { exact: true, name: 'Create task' }).click();
  await expect(drawer.getByLabel(/^Area/)).toBeFocused();
  assert.equal(
    api.requests.filter(
      (request) => request.method === 'POST' && /\/lists\/.+\/tasks$/.test(request.path),
    ).length,
    0,
  );
  await selectAutocomplete(drawer.getByLabel(/^Area/), 'Web');
  await drawer.getByLabel(/^Effort/).fill('0');
  await drawer.getByLabel(/^Approved/).check();
  await drawer.getByLabel(/^Approved/).uncheck();
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/lists\/.+\/tasks$/.test(new URL(response.url()).pathname),
  );
  await drawer.getByRole('button', { exact: true, name: 'Create task' }).click();
  await expect(drawer.getByRole('status', { exact: true, name: '' })).toContainText('Task created');
  assert.deepEqual((await (await created).json()).data.assigneeIds, [
    AuthExamples.session.data.user.id,
  ]);
  await drawer.getByRole('button', { exact: true, name: 'Close task' }).click();
  await page.getByRole('button', { exact: true, name: 'Open task: Created in drawer' }).click();
  await expect(drawer.getByLabel(/^Effort/)).toHaveValue('0');
  await expect(drawer.getByLabel(/^Approved/)).not.toBeChecked();
});

test('field errors from a rejected save retain edits and focus the first invalid control', async (t) => {
  const { api, drawer } = await openTask(t);
  await drawer.getByLabel(/^Title/).fill('Keep my edit');
  await drawer.getByLabel(/^Effort/).fill('8');
  api.controls.board.rejectNextWrite = {
    status: 400,
    code: 'FIELD_VALUE_INVALID',
    message: 'Check the marked fields.',
    details: [
      { code: 'invalid_type', path: ['customFields', 'effort'], message: 'Effort was rejected.' },
      { code: 'invalid_option', path: ['customFields', 'area'], message: 'Choose another area.' },
    ],
  };
  await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
  await expect(drawer.getByText('Effort was rejected.', { exact: true })).toBeVisible();
  await expect(drawer.getByLabel(/^Effort/)).toBeEnabled();
  await expect(drawer.getByLabel(/^Effort/)).toBeFocused();
  await expect(drawer.getByLabel(/^Effort/)).toHaveValue('8');
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Keep my edit');
});

test('archive requires confirmation and removes the task from the board after reload', async (t) => {
  const { page, api, drawer } = await openTask(t);
  await drawer.getByRole('button', { exact: true, name: 'Archive task' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Archive this task?' });
  await confirmation.getByRole('button', { exact: true, name: 'Cancel' }).click();
  assert.equal(api.requests.filter((request) => request.method === 'DELETE').length, 0);
  await drawer.getByRole('button', { exact: true, name: 'Archive task' }).click();
  const archived = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' &&
      /\/tasks\/[^/]+$/.test(new URL(response.url()).pathname),
  );
  await confirmation.getByRole('button', { exact: true, name: 'Archive task' }).click();
  assert.equal((await archived).status(), 204);
  await expect(confirmation).toHaveCount(0);
  await expect(page.getByRole('dialog', { includeHidden: true, name: 'Task details' })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { exact: true, name: 'Open task: Fix login' })).toHaveCount(
    0,
  );
  const request = api.requests.find((entry) => entry.method === 'DELETE');
  assert.deepEqual(request.body, { expectedConfigVersion: 1, expectedVersion: 1 });
  await page.reload();
  await expect(page.getByRole('region', { exact: true, name: 'Task board' })).toBeVisible();
  await expect(page.getByRole('button', { exact: true, name: 'Open task: Fix login' })).toHaveCount(
    0,
  );
});

test('Markdown preview renders formatting but never executable HTML or unsafe links', async (t) => {
  const { page, drawer } = await openTask(t);
  await drawer
    .getByLabel('Description', { exact: true })
    .fill(
      '## Preview heading\n\n**Strong text** and [Safe link](https://example.test).\n\n<script>window.__taskXss = true</script>\n\n[Unsafe](javascript:alert(1))',
    );
  await drawer.getByRole('button', { exact: true, name: 'Preview description' }).click();
  const preview = drawer.getByRole('region', { name: 'Description preview' });
  await expect(preview.getByRole('heading', { name: 'Preview heading' })).toBeVisible();
  await expect(preview.locator('strong')).toHaveText('Strong text');
  await expect(preview.getByRole('link', { name: 'Safe link' })).toHaveAttribute(
    'href',
    'https://example.test',
  );
  await expect(preview.locator('script')).toHaveCount(0);
  await expect(preview.locator('a').filter({ hasText: 'Unsafe' })).not.toHaveAttribute(
    'href',
    /javascript:/i,
  );
  assert.equal(await page.evaluate(() => window.__taskXss), undefined);
});

test('invalid save responses cannot overwrite the draft or become a new baseline', async (t) => {
  const { api, drawer } = await openTask(t);
  await drawer.getByLabel(/^Title/).fill('Keep the valid draft');
  api.controls.board.writeResponse = { customFields: { effort: 'wrong', area: ids.option } };
  await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
  await expect(drawer.getByRole('alert')).toContainText('could not be validated');
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Keep the valid draft');
  await expect(drawer.getByLabel(/^Effort/)).toHaveValue('5');
  await expect(drawer.getByRole('button', { exact: true, name: 'Save changes' })).toBeDisabled();
});

test('a newly created task reloads its saved identity after an editing conflict', async (t) => {
  const { page, api, drawer } = await openTask(t);
  await drawer.getByRole('button', { exact: true, name: 'Close task' }).click();
  await page.getByRole('button', { exact: true, name: 'New task' }).click();
  await drawer.getByLabel(/^Title/).fill('Created before conflict');
  await selectAutocomplete(drawer.getByLabel(/^Area/), 'Web');
  await drawer.getByRole('button', { exact: true, name: 'Create task' }).click();
  await expect(drawer.getByRole('status', { exact: true, name: '' })).toContainText('Task created');
  await drawer.getByLabel(/^Title/).fill('Uncommitted title');
  api.controls.board.rejectNextWrite = {
    code: 'VERSION_CONFLICT',
    message: 'Task changed. Reload before saving.',
    status: 409,
  };
  await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
  await expect(drawer.getByRole('alert')).toContainText('Task changed');
  await expect(drawer.getByRole('button', { exact: true, name: 'Save changes' })).toBeDisabled();
  await drawer.getByRole('button', { exact: true, name: 'Reload latest task' }).click();
  await page
    .getByRole('dialog', { name: 'Discard unsaved changes?' })
    .getByRole('button', { exact: true, name: 'Discard and reload' })
    .click();
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Created before conflict');
  await expect(drawer.getByRole('button', { exact: true, name: 'Save changes' })).toBeVisible();
  await expect(drawer.getByRole('button', { exact: true, name: 'Create task' })).toHaveCount(0);
});

test('all custom-field inputs save and optional fields can be explicitly cleared', async (t) => {
  const { api, drawer } = await openTask(t, true);
  await drawer.getByLabel(/^Effort/).fill('0');
  await selectAutocomplete(drawer.getByLabel(/^Area/), 'Web');
  await drawer.getByLabel(/^Approved/).uncheck();
  await selectAutocomplete(drawer.getByLabel(/^Tags/), 'Web');
  await drawer.getByLabel('Notes', { exact: true }).fill('Ready for review');
  const milestone = drawer.getByRole('group', { name: 'Milestone' });
  for (const [name, value] of [
    ['Year', '2026'],
    ['Month', '12'],
    ['Day', '02'],
  ]) {
    await milestone.getByRole('spinbutton', { name, exact: true }).focus();
    await milestone.getByRole('spinbutton', { name, exact: true }).pressSequentially(value);
  }
  await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
  await expect(drawer.getByRole('status', { exact: true, name: '' })).toContainText('Task saved');
  assert.deepEqual(
    api.requests.filter((item) => item.method === 'PATCH').at(-1).body.customFields,
    {
      effort: 0,
      area: ids.option,
      approved: false,
      tags: [mobileOption, ids.option],
      notes: 'Ready for review',
      milestone: '2026-12-02',
    },
  );
  await drawer.getByRole('button', { exact: true, name: 'Clear Tags' }).click();
  await drawer.getByLabel('Notes', { exact: true }).fill('');
  await milestone.getByRole('button', { name: 'Clear Milestone' }).click();
  await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
  await expect.poll(() => api.requests.filter((item) => item.method === 'PATCH').length).toBe(2);
  assert.deepEqual(
    api.requests.filter((item) => item.method === 'PATCH').at(-1).body.customFields,
    { milestone: null, notes: null, tags: null },
  );
});

test('duplicate submission keeps the pending save and close controls disabled', async (t) => {
  const { api, drawer } = await openTask(t);
  let release;
  api.controls.board.writeGate = new Promise((resolve) => {
    release = resolve;
  });
  t.after(() => release());
  await drawer.getByLabel(/^Title/).fill('One request only');
  await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
  await expect
    .poll(() => api.requests.filter((request) => request.method === 'PATCH').length)
    .toBe(1);
  await drawer.locator('form').evaluate((form) => form.requestSubmit());
  await expect(drawer.getByRole('button', { exact: true, name: 'Saving…' })).toBeDisabled();
  await expect(drawer.getByRole('button', { exact: true, name: 'Close task' })).toBeDisabled();
  release();
  await expect(drawer.getByRole('status', { exact: true, name: '' })).toContainText('Task saved');
  assert.equal(api.requests.filter((request) => request.method === 'PATCH').length, 1);
});

test('drawer controls fit all target widths and restore focus with reduced motion', async (t) => {
  const { page, drawer } = await openTask(t, true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mkdir(new URL('../../../.ai-local/p0904/', import.meta.url), { recursive: true });
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(async () => Math.round((await drawer.boundingBox()).width))
      .toBeLessThanOrEqual(width);
    const bounds = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    assert.ok(bounds.width <= bounds.viewport, JSON.stringify(bounds));
    await drawer.getByLabel(/^Title/).focus();
    await expect(drawer.getByLabel(/^Title/)).toBeFocused();
    await page.screenshot({
      path: new URL(`../../../.ai-local/p0904/drawer-${width}.png`, import.meta.url).pathname,
      fullPage: true,
    });
  }
  await drawer.getByRole('button', { exact: true, name: 'Close task' }).click();
  await expect(
    page.getByRole('button', { exact: true, name: 'Open task: Fix login' }),
  ).toBeFocused();
});

test('a failed background workspace refresh preserves the dirty drawer through retry', async (t) => {
  const { page, drawer } = await openTask(t);
  await drawer.getByLabel(/^Title/).fill('Keep this unsaved workspace draft');
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Try again later.' } }),
    }),
  );
  const failed = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/me') && response.status() === 503,
  );
  await page.evaluate(() => {
    const now = Date.now;
    Date.now = () => now() + 16000;
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    window.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  await failed;
  await expect(
    page.getByText('Workspace details could not refresh. Your draft is kept.'),
  ).toBeVisible();
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Keep this unsaved workspace draft');
  await page.unroute('**/api/v1/me');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    window.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(
    page.getByText('Workspace details could not refresh. Your draft is kept.'),
  ).toHaveCount(0);
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Keep this unsaved workspace draft');
  await drawer.getByRole('button', { exact: true, name: 'Close task' }).click();
  await expect(page.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeVisible();
});

for (const timezone of ['UTC', 'Asia/Kolkata', 'America/Los_Angeles'])
  test(`due-time editing stays in UTC in ${timezone}`, async (t) => {
    const { api, drawer } = await openTask(t, false, timezone);
    const due = drawer.getByRole('group', { name: /^Due date \(UTC\)/ });
    const seconds = due.getByRole('spinbutton', { name: 'Seconds' });
    await expect(seconds).toHaveText('00');
    await seconds.focus();
    await seconds.press('ArrowUp');
    await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
    await expect(drawer.getByRole('status', { exact: true, name: '' })).toContainText('Task saved');
    assert.equal(
      api.requests.filter((request) => request.method === 'PATCH').at(-1).body.dueDate,
      '2026-11-01T00:00:01.000Z',
    );
    await expect(seconds).toHaveText('01');
    const count = api.requests.filter((request) => request.method === 'PATCH').length;
    await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
    await expect(drawer.getByRole('alert')).toContainText('No changes to save.');
    assert.equal(api.requests.filter((request) => request.method === 'PATCH').length, count);
    await due.getByRole('spinbutton', { exact: true, name: 'Month' }).focus();
    await due.getByRole('spinbutton', { exact: true, name: 'Month' }).press('Delete');
    await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
    await expect(due).toHaveAttribute('aria-invalid', 'true');
    assert.equal(api.requests.filter((request) => request.method === 'PATCH').length, count);
    await due.getByRole('button', { name: 'Clear Due date (UTC)' }).click();
    await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
    await expect(drawer.getByRole('status', { exact: true, name: '' })).toContainText('Task saved');
    assert.equal(
      api.requests.filter((request) => request.method === 'PATCH').at(-1).body.dueDate,
      null,
    );
  });
