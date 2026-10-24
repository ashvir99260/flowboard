import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';

import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { ids } from './common/board-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

async function openBoard(t, configure = () => {}) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const api = await startAppApi(t);
  configure(api);
  const { origin } = await startWeb(t, api.origin);
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(`${origin}/login`);
  await page.getByLabel(/^Email/).fill('alice@example.test');
  await page.getByLabel(/^Password/).fill('browser-test-password');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Engineering/ }).click();
  await page.getByRole('button', { exact: true, name: 'Public list' }).click();
  const board = page.getByRole('region', { exact: true, name: 'Task board' });
  await board.waitFor();

  return { page, api, board };
}

test('button moves are optimistic, persist, and roll back rejected saves without losing the draft', async (t) => {
  const { page, api, board } = await openBoard(t);
  const todo = board.getByRole('region', { exact: true, name: 'To do column' });
  const active = board.getByRole('region', { exact: true, name: 'In progress column' });
  const title = await todo.getByRole('heading', { level: 3 }).first().textContent();
  await todo
    .getByRole('article')
    .first()
    .getByRole('button', { name: /^Move task/ })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Move task' });
  await dialog.getByLabel('Status', { exact: true }).selectOption(ids.active);
  const replyPromise = page.waitForResponse(
    (response) => response.url().endsWith('/move') && response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { exact: true, name: 'Save move' }).click();
  const reply = await replyPromise;
  assert.equal(reply.status(), 200, await reply.text());
  await expect(active.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(active.getByRole('heading', { name: title, exact: true })).toBeVisible();
  api.controls.board.rejectNextMove = 'FORBIDDEN';
  await active
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    .getByRole('button', { name: /^Move task/ })
    .click();
  await dialog.getByLabel('Status', { exact: true }).selectOption(ids.done);
  await dialog.getByRole('button', { exact: true, name: 'Save move' }).click();
  await dialog.getByText('Access denied', { exact: true }).waitFor();
  assert.equal(await dialog.getByLabel('Status', { exact: true }).inputValue(), ids.done);
  await dialog.getByRole('button', { exact: true, name: 'Cancel' }).click();
  await expect(active.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('drag instructions describe Space, arrows and Escape without promising Enter support', async (t) => {
  const { board } = await openBoard(t);
  const instructions = await board
    .getByRole('button', { name: /^Drag task/ })
    .first()
    .evaluate((element) =>
      (element.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' '),
    );
  assert.match(instructions, /Space/);
  assert.match(instructions, /arrow/i);
  assert.match(instructions, /Escape/);
  assert.doesNotMatch(instructions, /Enter/);
});

test('pointer dragging changes status and keyboard dragging reorders with focus and cancellation', async (t) => {
  const { page, board } = await openBoard(t);
  await page.setViewportSize({ height: 1600, width: 1440 });
  const todo = board.getByRole('region', { exact: true, name: 'To do column' });
  const active = board.getByRole('region', { exact: true, name: 'In progress column' });
  const card = todo
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { exact: true, name: 'Review navigation' }) });
  const handle = card.getByRole('button', { name: /^Drag task/ });
  const from = await handle.boundingBox();
  const to = await active.getByRole('article').first().boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 1, { steps: 15 });
  await page.mouse.up();
  await expect(
    active.getByRole('heading', { exact: true, name: 'Review navigation' }),
  ).toBeVisible();
  await expect(active.getByRole('heading', { level: 3 })).toHaveText([
    'Active task',
    'Review navigation',
  ]);
  const moved = active
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { exact: true, name: 'Review navigation' }) })
    .getByRole('button', { name: /^Drag task/ });
  await expect(moved).toBeEnabled();
  await moved.focus();
  await page.keyboard.press('Space');
  await expect(page.getByText(/^Picked up Review navigation, In progress/)).toBeAttached();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Move cancelled.', { exact: true })).toBeAttached();
  await expect(moved).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByText(/^Picked up Review navigation, In progress/)).toBeAttached();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByText(/^Over In progress, position 1/)).toBeAttached();
  await page.keyboard.press('Space');
  await expect(active.getByRole('heading', { level: 3 }).first()).toHaveText('Review navigation');
  await expect(moved).toBeEnabled();
  await expect(moved).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByText(/^Picked up Review navigation, In progress/)).toBeAttached();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByText(/^Over In progress, position 2/)).toBeAttached();
  await page.keyboard.press('Space');
  await expect(active.getByRole('heading', { level: 3 })).toHaveText([
    'Active task',
    'Review navigation',
  ]);
  await page.reload();
  await expect(active.getByRole('heading', { level: 3 })).toHaveText([
    'Active task',
    'Review navigation',
  ]);
});

test('keyboard ordering preserves the unloaded suffix and an unchanged drop sends no request', async (t) => {
  const { page, board, api } = await openBoard(t);
  const todo = board.getByRole('region', { exact: true, name: 'To do column' });
  const firstTitle = await todo.getByRole('heading', { level: 3 }).first().textContent();
  const handle = todo
    .getByRole('article')
    .first()
    .getByRole('button', { name: /^Drag task/ });
  await handle.focus();
  await page.keyboard.press('Space');
  await expect(page.getByText(/^Picked up Public board task/)).toBeAttached();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByText(/^Over To do, position 2/)).toBeAttached();
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/reorder') && response.request().method() === 'POST',
  );
  await page.keyboard.press('Space');
  assert.equal((await saved).status(), 200);
  await expect(todo.getByRole('heading', { level: 3 })).toHaveText([
    'Review navigation',
    firstTitle,
  ]);
  assert.deepEqual(
    api.requests.findLast((request) => request.path.endsWith('/reorder')).body.placement,
    { afterId: '50000000-0000-4000-8000-000000000002' },
  );
  await board.getByRole('button', { name: 'Load more To do tasks' }).click();
  await expect(todo.getByRole('heading', { level: 3 })).toHaveText([
    'Review navigation',
    firstTitle,
    'Next page task',
  ]);
  const before = api.requests.filter((request) => request.path.endsWith('/reorder')).length;
  await todo
    .getByRole('article')
    .first()
    .getByRole('button', { name: /^Drag task/ })
    .focus();
  await page.keyboard.press('Space');
  await expect(page.getByText(/^Picked up Review navigation/)).toBeAttached();
  await page.keyboard.press('Space');
  await expect(page.getByText('No move requested.', { exact: true })).toBeAttached();
  assert.equal(api.requests.filter((request) => request.path.endsWith('/reorder')).length, before);
});

test('destination board refreshes when a move settles after navigating away from its source', async (t) => {
  const { page, api, board } = await openBoard(t);
  await page.getByRole('button', { exact: true, name: 'Private list' }).click();
  await board.getByRole('heading', { name: 'Private board task' }).waitFor();
  await page.getByRole('button', { exact: true, name: 'Public list' }).click();
  const todo = board.getByRole('region', { exact: true, name: 'To do column' });
  const title = await todo.getByRole('heading', { level: 3 }).first().textContent();
  let release;
  api.controls.board.moveGates.set(
    '50000000-0000-4000-8000-000000000001',
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  t.after(() => release());
  await todo
    .getByRole('article')
    .first()
    .getByRole('button', { name: /^Move task/ })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Move task' });
  await dialog
    .getByLabel('Destination list', { exact: true })
    .selectOption('20000000-0000-4000-8000-000000000014');
  await expect(dialog.getByRole('button', { exact: true, name: 'Save move' })).toBeEnabled();
  await dialog.getByLabel('Placement', { exact: true }).selectOption('start');
  await dialog.getByRole('button', { exact: true, name: 'Save move' }).click();
  await expect
    .poll(() => api.requests.filter((request) => request.path.endsWith('/move')).length)
    .toBe(1);
  await page.goBack();
  await board.getByRole('heading', { name: 'Private board task' }).waitFor();
  release();
  await expect(board.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('cross-list move requires destination fields, focuses the error and persists the correction', async (t) => {
  const { page, api, board } = await openBoard(t);
  api.controls.board.requiredDestination = '20000000-0000-4000-8000-000000000014';
  await board
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { exact: true, name: 'Review navigation' }) })
    .getByRole('button', { name: /^Move task/ })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Move task' });
  await dialog.getByLabel('Destination list', { exact: true }).selectOption(api.privateList.id);
  const note = dialog.getByLabel('release_note');
  await note.waitFor();
  await dialog.getByLabel('Placement', { exact: true }).selectOption('start');
  await dialog.getByRole('button', { exact: true, name: 'Save move' }).click();
  await expect(note).toBeFocused();
  await note.fill('Preview ready');
  await dialog.getByRole('button', { exact: true, name: 'Save move' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { exact: true, name: 'Private list' }).click();
  await board
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { exact: true, name: 'Review navigation' }) })
    .getByRole('button', { name: /^Move task/ })
    .click();
  await expect(dialog.getByLabel('release_note')).toHaveValue('Preview ready');
});

test('cross-list move explicitly clears source-only fields', async (t) => {
  const { page, api, board } = await openBoard(t, (fixture) => {
    fixture.controls.board.sourceFieldList = fixture.publicList.id;
  });
  await board
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { exact: true, name: 'Review navigation' }) })
    .getByRole('button', { name: /^Move task/ })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Move task' });
  await dialog.getByLabel('Destination list', { exact: true }).selectOption(api.privateList.id);
  await dialog.getByText(/will be cleared: legacy/).waitFor();
  await dialog.getByLabel('Placement', { exact: true }).selectOption('start');
  await dialog.getByRole('button', { exact: true, name: 'Save move' }).click();
  await expect(dialog).toHaveCount(0);
  assert.equal(
    api.requests.find((request) => request.path.endsWith('/move')).body.customFields.legacy,
    null,
  );
});

test('duplicate submissions for one pending task issue only one mutation', async (t) => {
  const { page, api, board } = await openBoard(t);
  let release;
  api.controls.board.moveGates.set(
    '50000000-0000-4000-8000-000000000002',
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  t.after(() => release());
  await board
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { exact: true, name: 'Review navigation' }) })
    .getByRole('button', { name: /^Move task/ })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Move task' });
  await dialog.getByLabel('Status', { exact: true }).selectOption(ids.done);
  await dialog.locator('form').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect
    .poll(() => api.requests.filter((request) => request.path.endsWith('/move')).length)
    .toBe(1);
  await expect(dialog.getByRole('button', { exact: true, name: 'Saving…' })).toBeDisabled();
  await expect(dialog.getByRole('button', { exact: true, name: 'Cancel' })).toBeDisabled();
  await expect(dialog.getByLabel('Destination list', { exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('Status', { exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('Placement', { exact: true })).toBeDisabled();
  release();
  await expect(dialog).toHaveCount(0);
  assert.equal(api.requests.filter((request) => request.path.endsWith('/move')).length, 1);
});

async function dragTo(page, card, target) {
  const handle = card.getByRole('button', { name: /^Drag task/ });
  await expect(handle).toBeEnabled();
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  assert.ok(from && to);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
}

test('dropping a pointer drag outside the board cancels without a mutation', async (t) => {
  const { page, api, board } = await openBoard(t);
  await page.setViewportSize({ height: 1600, width: 1440 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const todo = board.getByRole('region', { exact: true, name: 'To do column' });
  const originalOrder = await todo.getByRole('heading', { level: 3 }).allTextContents();
  const card = todo
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { exact: true, name: 'Review navigation' }) });
  const handle = card.getByRole('button', { name: /^Drag task/ });
  const from = await handle.boundingBox();
  assert.ok(from);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 3 });
  await expect(page.getByText(/^Picked up Review navigation, To do/)).toBeAttached();
  await page.mouse.move(5, 5, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByText('Move cancelled.', { exact: true })).toBeAttached();
  await expect(handle).toBeFocused();
  assert.deepEqual(await todo.getByRole('heading', { level: 3 }).allTextContents(), originalOrder);
  assert.equal(
    api.requests.filter(
      (request) => request.method === 'POST' && request.path.startsWith('/v1/tasks/'),
    ).length,
    0,
  );
  await page.reload();
  await expect(todo.getByRole('heading', { level: 3 })).toHaveText(originalOrder);
});

test('rejection of one pending drag cannot undo another task saved in the meantime', async (t) => {
  const { page, api, board } = await openBoard(t);
  await page.setViewportSize({ height: 1600, width: 1440 });
  const todo = board.getByRole('region', { exact: true, name: 'To do column' });
  const active = board.getByRole('region', { exact: true, name: 'In progress column' });
  const done = board.getByRole('region', { exact: true, name: 'Done column' });
  const firstTitle = await todo.getByRole('heading', { level: 3 }).first().textContent();
  let release;
  const firstId = '50000000-0000-4000-8000-000000000001';
  api.controls.board.moveGates.set(
    firstId,
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  api.controls.board.rejectMoves.set(firstId, 'VERSION_CONFLICT');
  t.after(() => release());
  await dragTo(page, todo.getByRole('article').first(), active.getByRole('article').first());
  await expect(active.getByRole('heading', { name: firstTitle, exact: true })).toBeVisible();
  await dragTo(
    page,
    todo
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { exact: true, name: 'Review navigation' }) }),
    done,
  );
  await expect(done.getByRole('heading', { exact: true, name: 'Review navigation' })).toBeVisible();
  release();
  await page
    .getByRole('status')
    .filter({ hasText: 'Task changed. Refresh before retrying.' })
    .waitFor();
  await expect(todo.getByRole('heading', { name: firstTitle, exact: true })).toBeVisible();
  await expect(done.getByRole('heading', { exact: true, name: 'Review navigation' })).toBeVisible();
});

test('keyboard dragging can enter an empty status column', async (t) => {
  const { page, board } = await openBoard(t);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const card = board
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { exact: true, name: 'Active task' }) });
  const handle = card.getByRole('button', { name: /^Drag task/ });
  await handle.focus();
  await page.keyboard.press('Space');
  await expect(page.getByText(/^Picked up Active task, In progress/)).toBeAttached();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText(/^Over Done, position 1/)).toBeAttached();
  assert.ok(
    await board.getByRole('article').evaluateAll((cards) =>
      cards.every((card) =>
        getComputedStyle(card.parentElement)
          .transitionDuration.split(',')
          .every((value) => Number.parseFloat(value) <= 0.001),
      ),
    ),
  );
  await page.keyboard.press('Space');
  await expect(
    board
      .getByRole('region', { exact: true, name: 'Done column' })
      .getByRole('heading', { exact: true, name: 'Active task' }),
  ).toBeVisible();
  await expect(handle).toBeFocused();
});

test('move controls fit a 320px viewport, preserve focus and support reduced motion', async (t) => {
  const { page, board } = await openBoard(t);
  await page.setViewportSize({ height: 900, width: 320 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const card = board
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { exact: true, name: 'Review navigation' }) });
  const button = card.getByRole('button', { name: /^Move task/ });
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Move task' });
  await dialog.getByLabel('Status', { exact: true }).waitFor();
  await mkdir(new URL('../../../.ai-local/p0902/', import.meta.url), { recursive: true });
  await page.screenshot({
    path: new URL('../../../.ai-local/p0902/move-320.png', import.meta.url).pathname,
    fullPage: true,
  });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await dialog.getByRole('button', { exact: true, name: 'Cancel' }).click();
  await expect(button).toBeFocused();
  await button.click();
  await dialog.getByLabel('Status', { exact: true }).selectOption(ids.done);
  await dialog.getByRole('button', { exact: true, name: 'Save move' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    board
      .getByRole('region', { exact: true, name: 'Done column' })
      .getByRole('heading', { exact: true, name: 'Review navigation' }),
  ).toBeVisible();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});
