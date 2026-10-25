import { expect, test } from '@playwright/test';

import { column, login, openBacklog } from './helpers';

test('a second client sees keyboard moves and a stale optimistic move rolls back to the real saved task', async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ height: 1000, width: 1440 });
  await login(page);
  await openBacklog(page);
  const context = await browser.newContext({
    baseURL: process.env.FLOWBOARD_E2E_URL,
    viewport: { height: 1000, width: 1440 },
  });
  let release: (() => void) | undefined;
  try {
    const bob = await context.newPage();
    await login(bob, 'bob@example.com');
    await openBacklog(bob);
    const title = 'Build demo workflow 1';
    const handle = column(page, 'To do').getByRole('group', {
      exact: true,
      name: `Drag task: ${title}`,
    });
    await handle.focus();
    await page.keyboard.press('Space');
    await expect(page.getByText(/^Picked up/)).toBeAttached();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(/^Over In progress/)).toBeAttached();
    await page.keyboard.press('Space');
    await expect(
      column(bob, 'In progress').getByRole('heading', { exact: true, name: title }),
    ).toBeVisible();
    await expect(
      column(page, 'In progress').getByRole('group', { exact: true, name: `Drag task: ${title}` }),
    ).toBeEnabled();
    let intercepted: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      intercepted = resolve;
    });
    const target = '**/api/v1/tasks/f1000000-0000-4000-8000-000000000700/move';
    await page.route(target, async (route) => {
      intercepted?.();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.continue();
    });
    const staleResponse = page.waitForResponse((response) =>
      response.url().endsWith('/tasks/f1000000-0000-4000-8000-000000000700/move'),
    );
    const moved = column(page, 'In progress').getByRole('group', {
      exact: true,
      name: `Drag task: ${title}`,
    });
    await moved.focus();
    await page.keyboard.press('Space');
    await expect(page.getByText(/^Picked up/)).toBeAttached();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(/^Over Done/)).toBeAttached();
    await page.keyboard.press('Space');
    await held;
    await expect(
      column(page, 'Done').getByRole('heading', { exact: true, name: title }),
    ).toBeVisible();
    await bob.getByRole('button', { exact: true, name: `Open task: ${title}` }).click();
    const drawer = bob.getByRole('dialog', { name: 'Task details' });
    await drawer.getByLabel(/^Title/).fill('Concurrent saved task');
    await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
    await expect(
      drawer.getByRole('status', { exact: true, name: '' }).filter({ hasText: 'Task saved.' }),
    ).toBeVisible();
    release?.();
    const rejected = await staleResponse;
    expect(rejected.status()).toBe(409);
    expect((await rejected.json()).error.code).toBe('VERSION_CONFLICT');
    await expect(
      column(page, 'In progress').getByRole('heading', {
        exact: true,
        name: 'Concurrent saved task',
      }),
    ).toBeVisible();
    await expect(
      column(page, 'Done').getByRole('heading', { exact: true, name: 'Concurrent saved task' }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      column(page, 'In progress').getByRole('heading', {
        exact: true,
        name: 'Concurrent saved task',
      }),
    ).toBeVisible();
  } finally {
    release?.();
    await context.close();
  }
});
