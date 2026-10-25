import assert from 'node:assert/strict';
import test from 'node:test';

import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { ids } from './common/board-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

async function openWorkspace(t, { user = 'alice', configure = () => {} } = {}) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const api = await startAppApi(t);
  configure(api);
  const { origin } = await startWeb(t, api.origin);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  page.setDefaultTimeout(10000);
  await page.goto(`${origin}/login`);
  await page.getByLabel(/^Email/).fill(`${user}@example.test`);
  await page.getByLabel(/^Password/).fill('browser-test-password');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Engineering/ }).click();
  const board = page.getByRole('region', { exact: true, name: 'Workspace lists board' });
  const publicList = board.getByRole('region', { exact: true, name: 'Public list list column' });
  const privateList = board.getByRole('region', { exact: true, name: 'Private list list column' });
  await publicList.getByRole('article').first().waitFor();
  if (user === 'alice') await privateList.getByRole('article').first().waitFor();

  return { api, board, page, publicList, privateList };
}

test('workspace columns load visible lists with pagination and open tasks in their actual list', async (t) => {
  const { page, publicList, privateList } = await openWorkspace(t);
  await expect(publicList.getByRole('article')).toHaveCount(2);
  await publicList.getByRole('button', { name: 'Load more Public list tasks' }).click();
  await expect(publicList.getByRole('article')).toHaveCount(4);
  await privateList.getByRole('button', { name: 'Open task: Private board task' }).click();
  const drawer = page.getByRole('dialog', { name: 'Task details' });
  await expect(drawer.getByLabel('Title', { exact: true })).toHaveValue('Private board task');
  await drawer.getByRole('button', { name: 'Close task' }).click();
  await privateList.getByRole('link', { name: 'Open Private list status board' }).click();
  await page
    .getByRole('region', { name: 'Task board', exact: true })
    .getByRole('region', { name: 'Released column', exact: true })
    .waitFor();
});

test('workspace board does not request or render private list tasks for Bob', async (t) => {
  const { api, board, privateList } = await openWorkspace(t, { user: 'bob' });
  await expect(privateList).toHaveCount(0);
  await expect(board.getByRole('article')).toHaveCount(2);
  assert.equal(
    api.requests.some((entry) => entry.path === `/v1/lists/${api.privateList.id}/tasks`),
    false,
  );
});

test('keyboard drag moves across lists and a rejected move rolls back without losing another task', async (t) => {
  const { api, page, publicList, privateList } = await openWorkspace(t);
  const movingId = '50000000-0000-4000-8000-000000000002';
  const handle = publicList.getByRole('button', {
    name: 'Drag task: Review navigation',
    exact: true,
  });
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/tasks/${movingId}/move`) && response.request().method() === 'POST',
  );
  await handle.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  assert.equal((await saved).status(), 200);
  await expect(privateList.locator(`[data-open-task="${movingId}"]`)).toBeVisible();
  assert.equal(
    api.requests.findLast((entry) => entry.path.endsWith(`/tasks/${movingId}/move`)).body.statusId,
    ids.todo,
  );
  api.controls.board.rejectNextMove = 'FORBIDDEN';
  const rejected = page.waitForResponse(
    (response) => response.url().endsWith(`/tasks/${movingId}/move`) && response.status() === 403,
  );
  const back = privateList.locator(`[data-drag-task="${movingId}"]`);
  await back.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Space');
  await rejected;
  await expect(privateList.locator(`[data-open-task="${movingId}"]`)).toBeVisible();
  await expect(publicList.locator(`[data-open-task="${movingId}"]`)).toHaveCount(0);
});

test('a cross-list drop opens field correction, keeps the draft on denial, and saves the corrected move', async (t) => {
  const { api, page, publicList, privateList } = await openWorkspace(t, {
    configure: (fixture) => {
      fixture.controls.board.requiredDestination = fixture.privateList.id;
    },
  });
  const movingId = '50000000-0000-4000-8000-000000000002';
  const before = api.requests.filter((entry) => entry.path.endsWith('/move')).length;
  await publicList
    .getByRole('button', { name: 'Drag task: Review navigation', exact: true })
    .focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  const dialog = page.getByRole('dialog', { name: 'Complete move to Private list' });
  await dialog.waitFor();
  assert.equal(api.requests.filter((entry) => entry.path.endsWith('/move')).length, before);
  await dialog.getByRole('button', { name: 'Save move', exact: true }).click();
  const note = dialog.getByLabel('release_note', { exact: true });
  await expect(note).toBeFocused();
  await note.fill('Keep this draft');
  await dialog.getByLabel('Placement', { exact: true }).selectOption('start');
  api.controls.board.rejectNextMove = 'FORBIDDEN';
  await dialog.getByRole('button', { name: 'Save move', exact: true }).click();
  await dialog.getByText('Access denied', { exact: true }).waitFor();
  await expect(note).toHaveValue('Keep this draft');
  await dialog.getByRole('button', { name: 'Save move', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(privateList.locator(`[data-open-task="${movingId}"]`)).toBeVisible();
  assert.equal(
    api.requests.findLast((entry) => entry.path.endsWith(`/tasks/${movingId}/move`)).body
      .customFields.release_note,
    'Keep this draft',
  );
});
