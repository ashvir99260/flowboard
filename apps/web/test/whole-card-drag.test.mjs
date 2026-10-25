import assert from 'node:assert/strict';
import test from 'node:test';

import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

async function cardInteractions(page, card, title) {
  await expect(card).toHaveAttribute('data-rfd-drag-handle-draggable-id', /.+/);
  await expect(card.locator('[data-rfd-drag-handle-draggable-id]')).toHaveCount(0);
  await expect(card).toHaveAttribute('tabindex', '0');
  await card.getByRole('button', { name: `Open task: ${title}`, exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Task details' });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: 'Close task', exact: true }).click();

  const move = card.getByRole('button', { name: `Move task: ${title}`, exact: true });
  await move.focus();
  await page.keyboard.press('Space');
  const dialog = page.getByRole('dialog', { name: 'Move task', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(move).toBeFocused();

  await card.focus();
  await page.keyboard.press('Space');
  await expect(page.getByText(/^Picked up/)).toBeAttached();
  await page.keyboard.press('Escape');
  await expect(card).toBeFocused();
}

async function dragCardBody(page, card, destination) {
  const from = await card.getByRole('article').boundingBox();
  const to = await destination.boundingBox();
  assert.ok(from && to);
  const x = from.x + 4;
  const y = from.y + 24;
  assert.equal(
    await page.evaluate(
      ({ x, y }) =>
        Boolean(document.elementFromPoint(x, y)?.closest('button,input,textarea,select,a')),
      { x, y },
    ),
    false,
    'The pointer starts on card padding, not a title or action button',
  );
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
}

test(
  'whole task cards drag on both boards without breaking their nested controls',
  { timeout: 180000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startAppApi(t);
    const { origin } = await startWeb(t, api.origin, 'localhost', true);
    const page = await browser.newPage({ viewport: { height: 1400, width: 1440 } });
    page.setDefaultTimeout(15000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${origin}/login`);
    await page.getByLabel(/^Email/).fill('alice@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('button', { name: /Engineering/ }).click();
    const workspace = page.getByRole('region', { name: 'Workspace lists board', exact: true });
    const publicList = workspace.getByRole('region', {
      name: 'Public list list column',
      exact: true,
    });
    const privateList = workspace.getByRole('region', {
      name: 'Private list list column',
      exact: true,
    });
    await publicList.getByRole('article').first().waitFor();
    await privateList.getByRole('article').first().waitFor();

    await t.test(
      'workspace card body moves to another list and disables pending drag handles',
      async () => {
        const title = 'Review navigation';
        const taskId = '50000000-0000-4000-8000-000000000002';
        const card = publicList.getByRole('group', { name: `Drag task: ${title}`, exact: true });
        await cardInteractions(page, card, title);
        let release;
        api.controls.board.moveGates.set(
          taskId,
          new Promise((resolve) => {
            release = resolve;
          }),
        );
        const saved = page.waitForResponse((response) =>
          response.url().endsWith(`/tasks/${taskId}/move`),
        );
        const pending = privateList.locator(`[data-drag-task="${taskId}"]`);
        try {
          await dragCardBody(page, card, privateList.getByRole('article').first());
          await expect(pending).toBeVisible();
          await expect(pending).not.toHaveAttribute('data-rfd-drag-handle-draggable-id', /.+/);
          await expect(
            pending.getByRole('button', { name: `Move task: ${title}`, exact: true }),
          ).toBeDisabled();
        } finally {
          release();
          await saved;
        }
        assert.equal((await saved).status(), 200);
        await expect(pending).toHaveAttribute('data-rfd-drag-handle-draggable-id', taskId);
        await expect(publicList.locator(`[data-drag-task="${taskId}"]`)).toHaveCount(0);
      },
    );

    await page.getByRole('button', { name: 'Public list', exact: true }).click();
    const board = page.getByRole('region', { name: 'Task board', exact: true });
    await board.waitFor();
    await t.test(
      'status card body changes status and keeps title, Move and keyboard controls usable',
      async () => {
        const title = 'Public board task'.padEnd(500, 'x');
        const taskId = '50000000-0000-4000-8000-000000000001';
        const todo = board.getByRole('region', { name: 'To do column', exact: true });
        const done = board.getByRole('region', { name: 'Done column', exact: true });
        const card = todo.getByRole('group', { name: `Drag task: ${title}`, exact: true });
        await cardInteractions(page, card, title);
        const saved = page.waitForResponse((response) =>
          response.url().endsWith(`/tasks/${taskId}/move`),
        );
        const [response] = await Promise.all([saved, dragCardBody(page, card, done)]);
        assert.equal(response.status(), 200);
        await expect(
          done.getByRole('group', { name: `Drag task: ${title}`, exact: true }),
        ).toBeVisible();
        await expect(
          todo.getByRole('group', { name: `Drag task: ${title}`, exact: true }),
        ).toHaveCount(0);
      },
    );
  },
);
