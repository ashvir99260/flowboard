import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';

import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { ids } from './common/board-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';
import { mobileOption } from './common/table-fixture.mjs';

async function openList(t) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const api = await startAppApi(t);
  api.controls.board.tableMode = true;
  const { origin } = await startWeb(t, api.origin);
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(`${origin}/login`);
  await page.getByLabel(/^Email/).fill('alice@example.test');
  await page.getByLabel(/^Password/).fill('browser-test-password');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Engineering/ }).click();
  await page.getByRole('button', { exact: true, name: 'Public list' }).click();
  await page.getByRole('link', { exact: true, name: 'List' }).click();
  const table = page.getByRole('table', { name: 'List tasks' });
  await table.waitFor();
  await expect(page.getByRole('button', { exact: true, name: 'Apply filter' })).toBeEnabled();

  return { page, api, table };
}

test('list view renders resolved columns and requests cursor pages in server due-date order', async (t) => {
  const { page, api, table } = await openList(t);
  for (const name of ['Title', 'Status', 'Assignees', 'Priority', 'Due date', 'Effort', 'Area'])
    await expect(table.getByRole('columnheader', { name, exact: false })).toBeVisible();
  await expect(table.getByRole('row').nth(1)).toContainText('Fix login');
  await expect(table.getByRole('row').nth(2)).toContainText('Review scope');
  const first = api.requests.find(
    (request) => request.path.endsWith('/tasks') && !request.query.statusId,
  );
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
  await expect(page.getByLabel(/^Tags/)).toHaveValue(mobileOption);
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

test('sort and typed filters run on the server, retaining unsaved field values across sort changes', async (t) => {
  const { page, api, table } = await openList(t);
  await page.getByLabel('Filter field', { exact: true }).selectOption('effort');
  await page.getByLabel(/^Effort/).fill('0');
  await page.getByLabel('Sort by', { exact: true }).selectOption('priority');
  await expect(page.getByLabel(/^Effort/)).toHaveValue('0');
  await page.getByLabel('Direction', { exact: true }).selectOption('desc');
  await expect(table.getByRole('row').nth(1)).toContainText('Archive notes');
  await expect(table.getByRole('row').nth(2)).toContainText('Unscheduled work');
  await page.getByRole('button', { exact: true, name: 'Apply filter' }).click();
  await expect(table.getByRole('row').nth(2)).toContainText('Plan release');
  assert.equal(new URL(page.url()).searchParams.get('fieldValue'), '0');

  await page.getByLabel('Filter field', { exact: true }).selectOption('area');
  await page.getByLabel(/^Area/).selectOption(mobileOption);
  await page.getByRole('button', { exact: true, name: 'Apply filter' }).click();
  await expect(table.getByRole('row').nth(2)).toContainText('Fix login');

  await page.getByLabel('Filter field', { exact: true }).selectOption('approved');
  await expect(page.getByLabel(/^Approved/)).not.toBeChecked();
  await page.getByRole('button', { exact: true, name: 'Apply filter' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('fieldValue')).toBe('false');
  await page.getByRole('button', { exact: true, name: 'Load more tasks' }).click();
  await expect(table.getByRole('row').nth(3)).toContainText('Review scope');

  await page.getByLabel('Filter field', { exact: true }).selectOption('tags');
  await page.getByLabel(/^Tags/).selectOption(ids.option);
  await page.getByRole('button', { exact: true, name: 'Apply filter' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('fieldOperator')).toBe('contains');
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
  await page.getByLabel('Sort by', { exact: true }).selectOption('priority');
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect.poll(() => calls().length).toBeGreaterThan(beforeSort);
  assert.equal(calls().at(-1).query.cursor, undefined);
  assert.equal(calls().at(-1).query.sort, 'priority');
  await page.getByLabel('Direction', { exact: true }).selectOption('desc');
  await expect(table.getByRole('row').nth(1)).toContainText('Archive notes');
  await page.goBack();
  await expect(page.getByLabel('Direction', { exact: true })).toHaveValue('asc');
  await expect(table.getByRole('row').nth(1)).toContainText('Fix login');
  await expect(table.getByRole('row')).toHaveCount(3);
  await page.goBack();
  await expect(page.getByLabel('Sort by', { exact: true })).toHaveValue('dueDate');
  await expect(table.getByRole('row')).toHaveCount(3);
  assert.equal(calls().at(-1).query.cursor, undefined);
  await page.getByRole('link', { exact: true, name: 'Board' }).click();
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
  await page.getByLabel('Filter field', { exact: true }).selectOption('effort');
  await page.getByLabel(/^Effort/).fill('not a number');
  const before = queries().length;
  await page.getByRole('button', { exact: true, name: 'Apply filter' }).click();
  await expect(
    page.getByText('The filter value does not match this field.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Effort/)).toBeFocused();
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
  await page.getByLabel(/^Area/).selectOption(mobileOption);
  await page.getByRole('button', { exact: true, name: 'Apply filter' }).click();
  await expect(table).toBeVisible();
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

    const region = page.getByRole('region', { exact: true, name: 'Scrollable task list' });
    await region.focus();
    await expect(region).toBeFocused();
    const row = await table.getByRole('row').nth(1).boundingBox();
    assert.ok(
      row && row.height < 96,
      'Short task rows must not grow tall from compressed date columns',
    );
    const label = await page.locator('label').filter({ hasText: 'Filter field' }).boundingBox();
    const select = await page.getByLabel('Filter field', { exact: true }).boundingBox();
    assert.ok(
      label && select && label.y + label.height <= select.y + 12,
      'The floating filter label must not overlap the selected value',
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
  await page.getByRole('link', { exact: true, name: 'List' }).click();
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
  await page.getByRole('link', { exact: true, name: 'Board' }).click();
  const board = page.getByRole('region', { exact: true, name: 'Task board' });
  const card = board
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { exact: true, name: 'Fix login' }) });
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
  await dialog.getByLabel('Status', { exact: true }).selectOption(ids.done);
  await dialog.getByRole('button', { exact: true, name: 'Save move' }).click();
  await expect
    .poll(() => api.requests.filter((request) => request.path.endsWith('/move')).length)
    .toBe(1);
  await page.goBack();
  const row = table
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { exact: true, name: 'Fix login' }) });
  await expect(row).toContainText('In progress');
  release();
  await expect(row).toContainText('Done');
});
