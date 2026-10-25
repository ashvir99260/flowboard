import { expect, test } from '@playwright/test';

import { login, openBacklog } from './helpers';

import type { Page } from '@playwright/test';

const names = ['Build demo workflow 1', 'Review demo workflow 2'];
const rowFor = (page: Page, name: string) =>
  page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { exact: true, name: `Open task: ${name}` }) });

test('bulk editing retains a stale selection, then persists a fresh shared change', async ({
  page,
  browser,
}) => {
  await login(page);
  await openBacklog(page);
  await page
    .getByRole('navigation', { name: 'List views' })
    .getByRole('link', { exact: true, name: 'List' })
    .click();
  for (const name of names) await rowFor(page, name).getByRole('checkbox').check();

  await expect(page.getByText('2 of 50 selected', { exact: true })).toBeVisible();
  const other = await browser.newContext({ baseURL: process.env.FLOWBOARD_E2E_URL });
  try {
    const editor = await other.newPage();
    await login(editor);
    await openBacklog(editor);
    await editor.getByRole('button', { exact: true, name: `Open task: ${names[0]}` }).click();
    const drawer = editor.getByRole('dialog', { name: 'Task details' });
    await drawer.getByLabel(/^Effort/).fill('17');
    await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
    await expect(drawer.getByText('Task saved.', { exact: true })).toBeVisible();
  } finally {
    await other.close();
  }

  await page.getByRole('button', { exact: true, name: 'Edit selected tasks' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit selected tasks' });
  await dialog.getByLabel(/^Change/).selectOption('priority');
  await dialog.getByLabel(/^Priority for selected tasks/).selectOption('high');
  const conflict = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      /\/api\/v1\/tasks$/.test(new URL(response.url()).pathname),
  );
  await dialog.getByRole('button', { exact: true, name: 'Update selected tasks' }).click();
  expect((await conflict).status()).toBe(409);
  await expect(dialog.getByText(/Your selection has been preserved/)).toBeVisible();
  await expect(dialog.getByLabel(/^Priority for selected tasks/)).toHaveValue('high');
  await expect(
    dialog.getByRole('button', { exact: true, name: 'Update selected tasks' }),
  ).toBeDisabled();
  await dialog.getByRole('button', { exact: true, name: 'Cancel' }).click();
  await expect(page.getByText('2 of 50 selected', { exact: true })).toBeVisible();

  await page.getByRole('button', { exact: true, name: 'Clear selection' }).click();
  await page.reload();
  for (const name of names) await rowFor(page, name).getByRole('checkbox').check();

  await page.getByRole('button', { exact: true, name: 'Edit selected tasks' }).click();
  await dialog.getByLabel(/^Change/).selectOption('priority');
  await dialog.getByLabel(/^Priority for selected tasks/).selectOption('high');
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      /\/api\/v1\/tasks$/.test(new URL(response.url()).pathname),
  );
  await dialog.getByRole('button', { exact: true, name: 'Update selected tasks' }).click();
  expect((await saved).status()).toBe(200);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('0 of 50 selected', { exact: true })).toBeVisible();
  await page.reload();
  for (const name of names)
    await expect(rowFor(page, name).getByText('High', { exact: true })).toBeVisible();
});
