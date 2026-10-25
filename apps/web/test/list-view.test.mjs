import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';

import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { ids } from './common/board-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';
import { selectAutocomplete } from './common/selectAutocomplete.mjs';
import { mobileOption } from './common/table-fixture.mjs';

async function openList(t, { extraFields = false } = {}) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const api = await startAppApi(t);
  api.controls.board.tableMode = true;
  api.controls.board.extraFields = extraFields;
  const { origin } = await startWeb(
    t,
    api.origin,
    'localhost',
    process.env.FLOWBOARD_WEB_DEV_TEST === '1',
  );
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(60000);
  await page.goto(`${origin}/login`);
  await page.getByLabel(/^Email/).fill('alice@example.test');
  await page.getByLabel(/^Password/).fill('browser-test-password');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Engineering/ }).click();
  await page.getByRole('button', { exact: true, name: 'Public list' }).click();
  await page.getByRole('region', { exact: true, name: 'Task board' }).waitFor();
  const requestStart = api.requests.length;
  await page.getByRole('link', { exact: true, name: 'List view' }).click();
  const table = page.getByRole('grid', { name: 'List tasks' });
  await table.waitFor();
  await expect(page.getByRole('button', { exact: true, name: 'Filters' })).toBeEnabled();
  await expect(
    table.getByRole('button', { exact: true, name: 'Open task: Fix login' }),
  ).toBeVisible();

  return { page, api, table, requestStart };
}

test('list view renders resolved columns and requests cursor pages in server due-date order', async (t) => {
  const { page, api, table, requestStart } = await openList(t);
  for (const name of ['Title', 'Status', 'Assignees', 'Priority', 'Due date', 'Effort', 'Area'])
    await expect(table.getByRole('columnheader', { name, exact: false })).toBeVisible();
  await expect(table.getByRole('row').nth(1)).toContainText('Fix login');
  await expect(table.getByRole('row').nth(2)).toContainText('Review scope');
  const first = api.requests
    .slice(requestStart)
    .find((request) => request.path.endsWith('/tasks') && !request.query.statusId);
  assert.equal(first.query.sort, 'dueDate');
  assert.equal(first.query.direction, 'asc');
  await page.getByRole('button', { exact: true, name: 'Load more tasks' }).click();
  await expect(table.getByRole('row').nth(3)).toContainText('Plan release');
  await expect(table.getByRole('row').nth(4)).toContainText('Unscheduled work');
  await page.getByRole('button', { exact: true, name: 'Load more tasks' }).click();
  await expect(table.getByRole('row').nth(5)).toContainText('Archive notes');
  await expect(page.getByRole('button', { exact: true, name: 'Load more tasks' })).toHaveCount(0);
});

test('valid uppercase option IDs display normally while cursor requests preserve the raw value', async (t) => {
  const { page, api, table } = await openList(t);
  const raw = JSON.stringify(mobileOption.toUpperCase());
  const url = new URL(page.url());
  url.search = new URLSearchParams({
    view: 'list',
    fieldKey: 'tags',
    fieldOperator: 'contains',
    fieldValue: raw,
  }).toString();
  await page.goto(url.toString());
  await expect(table).toBeVisible();
  await page.getByRole('button', { exact: true, name: 'Filters' }).click();
  await expect(page.getByRole('combobox', { exact: true, name: 'Value' })).toContainText('Mobile');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { exact: true, name: 'Load more tasks' }).click();
  await expect(table.getByRole('row').nth(3)).toContainText('Archive notes');
  const requests = api.requests.filter((request) => request.query.fieldKey === 'tags');
  assert.ok(requests.some((request) => request.query.cursor));
  assert.ok(requests.every((request) => request.query.fieldValue === raw));
});

test('manual refresh restarts the complete list at its first page', async (t) => {
  const { page, table } = await openList(t);
  await page.getByRole('button', { exact: true, name: 'Load more tasks' }).click();
  await expect(table.getByRole('row')).toHaveCount(5);
  await page.getByRole('button', { exact: true, name: 'Refresh tasks' }).click();
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(table.getByRole('row').nth(1)).toContainText('Fix login');
  await expect(table.getByText('Plan release', { exact: true })).toHaveCount(0);
});

async function filterField(page, field, value) {
  await page.getByRole('button', { exact: true, name: 'Filters' }).click();
  await page.getByRole('combobox', { exact: true, name: 'Column' }).click();
  await page.getByRole('option', { name: field, exact: true }).click();
  if (field === 'Effort')
    await page.getByRole('spinbutton', { exact: true, name: 'Value' }).fill(value);
  else {
    await page.getByRole('combobox', { exact: true, name: 'Value' }).click();
    await page.getByRole('option', { name: value, exact: true }).click();
  }
}

test('native column sorting and typed filters run on the server across cursor pages', async (t) => {
  const { page, api, table } = await openList(t);
  await table.getByRole('columnheader', { exact: true, name: 'Priority' }).click();
  await expect(table.getByRole('columnheader', { name: /Priority/ })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  await table.getByRole('columnheader', { name: /Priority/ }).click();
  await expect(table.getByRole('row').nth(1)).toContainText('Archive notes');
  await expect(table.getByRole('row').nth(2)).toContainText('Unscheduled work');
  await filterField(page, 'Effort', '0');
  await expect(table.getByRole('row').nth(2)).toContainText('Plan release');
  assert.equal(new URL(page.url()).searchParams.get('fieldValue'), '0');

  await filterField(page, 'Area', 'Mobile');
  await expect(table.getByRole('row').nth(2)).toContainText('Fix login');

  await filterField(page, 'Approved', 'false');
  await expect.poll(() => new URL(page.url()).searchParams.get('fieldValue')).toBe('false');
  await page.getByRole('button', { exact: true, name: 'Load more tasks' }).click();
  await expect(table.getByRole('row').nth(3)).toContainText('Review scope');

  await filterField(page, 'Tags', 'Web');
  await expect.poll(() => new URL(page.url()).searchParams.get('fieldOperator')).toBe('contains');
  await expect
    .poll(() => api.requests.filter((request) => request.query.fieldKey === 'tags').length)
    .toBeGreaterThan(0);
  const query = api.requests.filter((request) => request.query.fieldKey === 'tags').at(-1).query;
  assert.equal(query.fieldValue, JSON.stringify(ids.option));
  assert.equal(query.fieldOperator, 'contains');
});

test('browser history, sorting and filtering reset cursor chains instead of reusing an old page', async (t) => {
  const { page, api, table } = await openList(t);
  const calls = () =>
    api.requests.filter((request) => request.path.endsWith('/tasks') && !request.query.statusId);
  await page.getByRole('button', { exact: true, name: 'Load more tasks' }).click();
  await expect(table.getByRole('row')).toHaveCount(5);
  const beforeSort = calls().length;
  await table.getByRole('columnheader', { exact: true, name: 'Priority' }).click();
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect.poll(() => calls().length).toBeGreaterThan(beforeSort);
  assert.equal(calls().at(-1).query.cursor, undefined);
  assert.equal(calls().at(-1).query.sort, 'priority');
  await table.getByRole('columnheader', { name: /Priority/ }).click();
  await expect(table.getByRole('row').nth(1)).toContainText('Archive notes');
  await page.goBack();
  await expect(table.getByRole('columnheader', { name: /Priority/ })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  await expect(table.getByRole('row').nth(1)).toContainText('Fix login');
  await expect(table.getByRole('row')).toHaveCount(3);
  await page.goBack();
  await expect(table.getByRole('columnheader', { name: /Due date/ })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  await expect(table.getByRole('row')).toHaveCount(3);
  assert.equal(calls().at(-1).query.cursor, undefined);
  await page.getByRole('link', { exact: true, name: 'Board view' }).click();
  await expect.poll(() => new URL(page.url()).search).toBe('');
  await expect(page.getByRole('region', { exact: true, name: 'Task board' })).toBeVisible();
  await page.goBack();
  await expect(table).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(3);
});

test('invalid filter inputs stay local and invalid URLs recover without issuing task queries', async (t) => {
  const { page, api, table } = await openList(t);
  const queries = () =>
    api.requests.filter((request) => request.path.endsWith('/tasks') && !request.query.statusId);
  await page.getByRole('button', { exact: true, name: 'Filters' }).click();
  const before = queries().length;
  await page.getByRole('spinbutton', { exact: true, name: 'Value' }).fill('');
  await page.keyboard.press('Escape');
  assert.equal(queries().length, before);

  const invalidFilter = new URL(page.url());
  invalidFilter.search = new URLSearchParams({
    fieldKey: 'area',
    fieldOperator: 'eq',
    fieldValue: '"unavailable"',
    view: 'list',
  }).toString();
  await page.goto(invalidFilter.toString());
  await expect(page.getByRole('alert', { name: 'Invalid filter' })).toBeVisible();
  assert.equal(queries().length, before);
  await page.getByRole('button', { exact: true, name: 'Clear filter' }).click();
  await expect(table.getByRole('row')).toHaveCount(3);
  const beforeUnknown = queries().length;
  const invalidView = new URL(page.url());
  invalidView.search = 'view=calendar';
  await page.goto(invalidView.toString());
  await expect(page.getByRole('alert', { name: 'Invalid list options' })).toBeVisible();
  assert.equal(queries().length, beforeUnknown);
  await page.getByRole('link', { exact: true, name: 'Reset view' }).click();
  await expect(page.getByRole('region', { exact: true, name: 'Task board' })).toBeVisible();
});

test('stale cursors restart safely and repeated revision changes stop at a visible retry', async (t) => {
  const { page, api, table } = await openList(t);
  api.controls.board.staleCursorOnce = true;
  const firstPages = () =>
    api.requests.filter(
      (request) =>
        request.path.endsWith('/tasks') && !request.query.statusId && !request.query.cursor,
    ).length;
  const before = firstPages();
  const staleReply = page.waitForResponse(
    (response) => response.status() === 409 && response.url().includes('/tasks'),
  );
  await page.getByRole('button', { exact: true, name: 'Load more tasks' }).click();
  await staleReply;
  await expect.poll(firstPages).toBeGreaterThan(before);
  await expect(table.getByRole('row')).toHaveCount(3);

  api.controls.board.driftRounds = 3;
  const priorDrift = firstPages();
  await page.getByRole('button', { exact: true, name: 'Refresh tasks' }).click();
  await expect(page.getByRole('alert', { name: 'Unable to load tasks' })).toContainText(
    'The list changed while loading. Try again.',
  );
  assert.equal(firstPages() - priorDrift, 3);
  await page.getByRole('button', { exact: true, name: 'Retry tasks' }).click();
  await expect(table.getByRole('row')).toHaveCount(3);
});

test('forbidden and empty task responses are explicit and recoverable', async (t) => {
  const { page, api, table } = await openList(t);
  api.controls.board.error = 'FORBIDDEN';
  await page.getByRole('button', { exact: true, name: 'Refresh tasks' }).click();
  await expect(page.getByRole('alert', { name: 'Access denied' })).toBeVisible();
  api.controls.board.error = null;
  await page.getByRole('button', { exact: true, name: 'Retry tasks' }).click();
  await expect(table).toBeVisible();
  api.controls.board.empty = true;
  await page.getByRole('button', { exact: true, name: 'Refresh tasks' }).click();
  await expect(page.getByText('No matching tasks', { exact: true })).toBeVisible();
  api.controls.board.empty = false;
  await page.getByRole('button', { exact: true, name: 'Refresh tasks' }).click();
  await expect(table).toBeVisible();
});

test('table controls fit all target widths and the table remains keyboard-scrollable', async (t) => {
  const { page, table } = await openList(t);
  await mkdir(new URL('../../../.ai-local/p0903/', import.meta.url), { recursive: true });
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width < 900)
      await expect(
        page.getByRole('button', { exact: true, name: 'Open navigation' }),
      ).toBeVisible();
    else
      await expect(page.getByRole('button', { exact: true, name: 'Open navigation' })).toHaveCount(
        0,
      );

    const titleHeader = table.getByRole('columnheader', { exact: true, name: 'Title' });
    await titleHeader.focus();
    await page.keyboard.press('ArrowDown');
    await expect(
      table.getByRole('button', { exact: true, name: 'Open task: Fix login' }),
    ).toBeFocused();
    const row = await table.getByRole('row').nth(1).boundingBox();
    assert.ok(
      row && row.height < 96,
      'Short task rows must not grow tall from compressed date columns',
    );
    const bounds = await page.evaluate(() => ({
      viewport: innerWidth,
      width: document.documentElement.scrollWidth,
      escaped: [...document.querySelectorAll('main, main > *, form, [role="region"]')].map(
        (element) => ({
          tag: element.tagName,
          role: element.getAttribute('role'),
          width: Math.round(element.getBoundingClientRect().width),
          right: Math.round(element.getBoundingClientRect().right),
        }),
      ),
    }));
    assert.ok(bounds.width <= bounds.viewport, JSON.stringify(bounds));
    await page.screenshot({
      path: new URL(`../../../.ai-local/p0903/table-${width}.png`, import.meta.url).pathname,
      fullPage: true,
    });
    await page.getByRole('button', { exact: true, name: 'Filters' }).click();
    const panel = await page.getByRole('dialog').boundingBox();
    assert.ok(
      panel && panel.width <= width && panel.x >= 0 && panel.x + panel.width <= width,
      `Filter panel must stay within the ${width}px viewport`,
    );
    await page.keyboard.press('Escape');
  }
  await expect(table.getByRole('columnheader', { name: /Area/ })).toContainText('Inherited');
  await expect(table.getByRole('columnheader', { name: /Approved/ })).toContainText('Local');
});

test('changing lists discards delayed old pages and starts a fresh cursor chain', async (t) => {
  const { page, api, table } = await openList(t);
  await page.getByRole('button', { exact: true, name: 'Load more tasks' }).click();
  await expect(table.getByRole('row')).toHaveCount(5);
  let release;
  api.controls.board.publicGate = new Promise((resolve) => {
    release = resolve;
  });
  t.after(() => release());
  const request = page.waitForRequest((entry) =>
    entry.url().includes(`${api.publicList.id}/resolved-statuses`),
  );
  await page.getByRole('button', { exact: true, name: 'Refresh tasks' }).click();
  await request;
  await page.getByRole('button', { exact: true, name: 'Private list' }).click();
  await page.getByRole('link', { exact: true, name: 'List view' }).click();
  await expect(table.getByRole('row').nth(1)).toContainText('Private Fix login');
  await expect(table.getByRole('row')).toHaveCount(3);
  release();
  api.controls.board.publicGate = null;
  await page.getByRole('button', { exact: true, name: 'Refresh tasks' }).click();
  await expect(table.getByRole('row').nth(1)).toContainText('Private Fix login');
  await expect(table.getByText('Plan release', { exact: true })).toHaveCount(0);
  assert.equal(new URL(page.url()).pathname.endsWith(api.privateList.id), true);
});

test('a board mutation settling after view navigation refreshes the task table', async (t) => {
  const { page, api, table } = await openList(t);
  await page.getByRole('link', { exact: true, name: 'Board view' }).click();
  const board = page.getByRole('region', { exact: true, name: 'Task board' });
  const card = board
    .getByRole('article')
    .filter({ has: page.getByRole('button', { exact: true, name: 'Open task: Fix login' }) });
  let release;
  api.controls.board.moveGates.set(
    '50000000-0000-4000-8000-000000000002',
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  t.after(() => release());
  await card.getByRole('button', { name: /^Move task/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Move task' });
  await selectAutocomplete(dialog.getByLabel('Status', { exact: true }), 'Done');
  await dialog.getByRole('button', { exact: true, name: 'Save move' }).click();
  await expect
    .poll(() => api.requests.filter((request) => request.path.endsWith('/move')).length)
    .toBe(1);
  await page.goBack();
  const row = table
    .getByRole('row')
    .filter({ has: page.getByRole('button', { exact: true, name: 'Open task: Fix login' }) });
  await expect(row).toContainText('In progress');
  release();
  await expect(row).toContainText('Done');
});

test('row body opens the task once and restores its title focus, while text selection remains usable', async (t) => {
  const { page, table } = await openList(t);
  const title = table.getByRole('button', { exact: true, name: 'Open task: Fix login' });
  const row = title.locator('xpath=ancestor::*[@role="row"]');
  const status = row.locator('[data-field="statusId"]');
  await status.click({ modifiers: ['Control'] });
  const drawer = page.getByRole('dialog', { name: 'Task details' });
  await expect(drawer).toHaveCount(0);
  await status.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
  });
  await expect(drawer).toHaveCount(0);
  await page.evaluate(() => window.getSelection().removeAllRanges());
  await status.click();
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Fix login');
  await drawer.getByRole('button', { exact: true, name: 'Close task' }).click();
  await expect(title).toBeFocused();
  await title.press('Enter');
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Fix login');
  await expect(drawer).toHaveCount(1);
});

test('slow native text filtering keeps the filter focused across successful query updates', async (t) => {
  const { page, table } = await openList(t, { extraFields: true });
  await page.getByRole('button', { exact: true, name: 'Filters' }).click();
  await page.getByRole('combobox', { exact: true, name: 'Column' }).click();
  await page.getByRole('option', { exact: true, name: 'Notes' }).click();
  const input = page.getByRole('textbox', { exact: true, name: 'Value' });
  const matchingReply = (value) =>
    page.waitForResponse((response) => {
      const url = new URL(response.url());

      return (
        url.pathname.endsWith('/tasks') &&
        url.searchParams.get('fieldKey') === 'notes' &&
        url.searchParams.get('fieldValue') === JSON.stringify(value) &&
        response.status() === 200
      );
    });
  const first = matchingReply('a');
  await input.pressSequentially('a');
  await first;
  await expect(table.getByText('No matching tasks', { exact: true })).toBeVisible();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('a');
  const second = matchingReply('ab');
  await input.pressSequentially('b');
  await second;
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('ab');
  await expect.poll(() => new URL(page.url()).searchParams.get('fieldValue')).toBe('"ab"');
});

test('overlapping text filters keep the latest draft and clear hidden bulk targets', async (t) => {
  const { page, table } = await openList(t, { extraFields: true });
  const selected = table.getByRole('row').filter({ hasText: 'Fix login' }).getByRole('checkbox');
  await selected.click();
  await expect(selected).toBeChecked();
  await expect(
    page.getByRole('button', { exact: true, name: 'Edit selected tasks' }),
  ).toBeEnabled();
  let release;
  let arrived;
  const firstQuery = new Promise((resolve) => {
    arrived = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  t.after(() => release());
  await page.route('**/api/v1/lists/*/tasks?*', async (route) => {
    const url = new URL(route.request().url());
    if (
      url.searchParams.get('fieldKey') === 'notes' &&
      url.searchParams.get('fieldValue') === '"a"'
    ) {
      arrived();
      await gate;
      await route.continue().catch(() => {});

      return;
    }

    await route.continue();
  });
  const navigations = [];
  page.on('request', (request) => {
    if (new URL(request.url()).searchParams.has('_rsc')) navigations.push(request.url());
  });
  await page.getByRole('button', { exact: true, name: 'Filters' }).click();
  await page.getByRole('combobox', { exact: true, name: 'Column' }).click();
  await page.getByRole('option', { exact: true, name: 'Notes' }).click();
  const input = page.getByRole('textbox', { exact: true, name: 'Value' });
  await input.pressSequentially('a');
  await firstQuery;
  await expect(input).toBeFocused();
  await expect(page.getByRole('button', { exact: true, name: 'Edit selected tasks' })).toHaveCount(
    0,
  );
  const latest = page.waitForResponse((response) => {
    const url = new URL(response.url());

    return (
      url.pathname.endsWith('/tasks') &&
      url.searchParams.get('fieldValue') === '"ab"' &&
      response.status() === 200
    );
  });
  await input.pressSequentially('b');
  await latest;
  release();
  await expect(table.getByText('No matching tasks', { exact: true })).toBeVisible();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('ab');
  await expect.poll(() => new URL(page.url()).searchParams.get('fieldValue')).toBe('"ab"');
  assert.deepEqual(navigations, [], 'query-only edits do not start delayed server navigations');
});
