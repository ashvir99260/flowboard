import test from 'node:test';

import { ActivitySchema } from '@flowboard/contracts';
import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { ids, task, workspaceId } from './common/board-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

test('activity loads older pages and refreshes without resetting a dirty task draft', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const api = await startAppApi(t);
  api.controls.board.tableMode = true;
  let release;
  t.after(() => release?.());
  api.controls.board.activityGate = new Promise((resolve) => {
    release = resolve;
  });
  const item = ActivitySchema.parse({
    ...ActivitySchema.meta().example,
    workspaceId,
    taskId: task(2).id,
    payload: {
      ...ActivitySchema.meta().example.payload,
      beforeStatusId: ids.todo,
      afterStatusId: ids.active,
    },
  });
  api.controls.board.activityPages.set('', {
    items: [item],
    pageInfo: { hasNextPage: true, nextCursor: 'older' },
  });
  api.controls.board.activityPages.set('older', {
    items: [
      {
        ...item,
        id: '81000000-0000-4000-8000-000000000000',
        eventId: '81000000-0000-4000-8000-000000000099',
        createdAt: '2026-10-23T10:00:01.000Z',
      },
    ],
    pageInfo: { hasNextPage: false, nextCursor: null },
  });
  const web = await startWeb(
    t,
    api.origin,
    'localhost',
    process.env.FLOWBOARD_WEB_DEV_TEST === '1',
  );
  const page = await browser.newPage();
  await page.goto(`${web.origin}/login`);
  await page.getByLabel(/^Email/).fill('alice@example.test');
  await page.getByLabel(/^Password/).fill('browser-test-password');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Engineering/ }).click();
  await page.getByRole('button', { exact: true, name: 'Public list' }).click();
  await page.getByRole('button', { exact: true, name: 'Open task: Fix login' }).click();
  const drawer = page.getByRole('dialog', { name: 'Task details' });
  await expect(drawer.getByText('Loading activity…')).toBeVisible();
  await drawer.getByLabel(/^Title/).fill('Keep this draft');
  release();
  const feed = drawer.getByRole('region', { exact: true, name: 'Activity' });
  await expect(feed.getByRole('listitem')).toHaveCount(1);
  await expect(feed).toContainText('To do');
  await expect(feed).toContainText('In progress');
  await feed.getByRole('button', { name: 'Load older activity' }).click();
  await expect(feed.getByRole('listitem')).toHaveCount(2);
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Keep this draft');
  api.controls.board.activityError = true;
  await feed.getByRole('button', { name: 'Refresh activity' }).click();
  await expect(feed.getByText('Activity unavailable')).toBeVisible();
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Keep this draft');
  api.controls.board.activityError = null;
  api.controls.board.activityPages.clear();
  await feed.getByRole('button', { name: 'Retry activity' }).click();
  await expect(feed.getByText('No status changes yet.')).toBeVisible();
  api.controls.board.activityError = { code: 'INVALID_CURSOR', once: true, status: 400 };
  const rejected = page.waitForResponse(
    (response) => response.url().includes('/activity') && response.status() === 400,
  );
  await feed.getByRole('button', { name: 'Refresh activity' }).click();
  await rejected;
  await expect(feed.getByText('No status changes yet.')).toBeVisible();
  await expect(drawer.getByLabel(/^Title/)).toHaveValue('Keep this draft');
});
