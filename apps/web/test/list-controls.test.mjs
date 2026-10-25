import assert from 'node:assert/strict';
import test from 'node:test';

import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

async function openListWorkspace(t) {
  const api = await startAppApi(t);
  api.controls.board.tableMode = true;
  const { origin } = await startWeb(
    t,
    api.origin,
    'localhost',
    process.env.FLOWBOARD_WEB_DEV_TEST === '1',
  );
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(`${origin}/login`);
  await page.getByLabel(/^Email/).fill('alice@example.test');
  await page.getByLabel(/^Password/).fill('browser-test-password');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Engineering/ }).click();
  await page.getByRole('button', { exact: true, name: 'Public list' }).click();
  await expect(page.getByRole('region', { exact: true, name: 'Task board' })).toBeVisible();

  return page;
}

test('icon view links have tooltips, preserve keyboard access, and follow browser history', async (t) => {
  const page = await openListWorkspace(t);
  const navigation = page.getByRole('navigation', { name: 'List views' });
  const board = navigation.getByRole('link', { exact: true, name: 'Board view' });
  const list = navigation.getByRole('link', { exact: true, name: 'List view' });
  await expect(board).toHaveAttribute('aria-current', 'page');
  await expect(board).toHaveText('');
  await expect(list).toHaveText('');
  await list.hover();
  await expect(page.getByRole('tooltip', { name: 'List view' })).toBeVisible();
  await list.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('grid', { name: 'List tasks' })).toBeVisible();
  await expect(list).toHaveAttribute('aria-current', 'page');
  assert.equal(new URL(page.url()).searchParams.get('view'), 'list');
  await board.hover();
  await expect(page.getByRole('tooltip', { name: 'Board view' })).toBeVisible();
  await board.click();
  await expect(page.getByRole('region', { exact: true, name: 'Task board' })).toBeVisible();
  assert.equal(new URL(page.url()).search, '');
  await page.goBack();
  await expect(page.getByRole('grid', { name: 'List tasks' })).toBeVisible();
  await expect(list).toHaveAttribute('aria-current', 'page');
});

test('bulk actions appear only for a selection and disappear after clearing or deselecting', async (t) => {
  const page = await openListWorkspace(t);
  await page.getByRole('link', { exact: true, name: 'List view' }).click();
  const grid = page.getByRole('grid', { name: 'List tasks' });
  await expect(grid).toBeVisible();
  const edit = page.getByRole('button', { exact: true, name: 'Edit selected tasks' });
  const clear = page.getByRole('button', { exact: true, name: 'Clear selection' });
  await expect(edit).toHaveCount(0);
  await expect(clear).toHaveCount(0);
  await expect(page.getByText('0 of 50 selected', { exact: true })).toHaveCount(0);
  const first = grid.getByRole('row').filter({ hasText: 'Fix login' }).getByRole('checkbox');
  const second = grid.getByRole('row').filter({ hasText: 'Review scope' }).getByRole('checkbox');
  await first.click();
  await expect(first).toBeChecked();
  await expect(edit).toBeEnabled();
  await expect(page.getByText('1 of 50 selected', { exact: true })).toBeVisible();
  await second.click();
  await expect(second).toBeChecked();
  await expect(page.getByText('2 of 50 selected', { exact: true })).toBeVisible();
  await clear.click();
  await expect(first).not.toBeChecked();
  await expect(second).not.toBeChecked();
  await expect(edit).toHaveCount(0);
  await expect(clear).toHaveCount(0);
  await first.click();
  await expect(first).toBeChecked();
  await expect(edit).toBeEnabled();
  await first.click();
  await expect(first).not.toBeChecked();
  await expect(edit).toHaveCount(0);
  await expect(clear).toHaveCount(0);
});
