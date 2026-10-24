import { expect, test } from '@playwright/test';

test('login, select a list, edit a custom field and reload persisted data', async ({
  page,
  browser,
}) => {
  await page.goto('/login');
  await page.getByLabel(/^Email/).fill('alice@example.com');
  await page.getByLabel(/^Password/).fill('FlowboardDemo123!');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Flowboard Demo/ }).click();
  await page.getByRole('button', { exact: true, name: 'Product backlog' }).click();
  const board = page.getByRole('region', { exact: true, name: 'Task board' });
  for (const name of ['To do', 'In progress', 'Done', 'Closed'])
    await expect(board.getByRole('region', { exact: true, name: `${name} column` })).toBeVisible();
  await page.getByRole('button', { exact: true, name: 'Open task: Build demo workflow 1' }).click();
  const drawer = page.getByRole('dialog', { name: 'Task details' });
  await drawer.getByLabel(/^Effort/).fill('7');
  await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
  await expect(drawer.getByRole('status', { exact: true, name: '' })).toContainText('Task saved');
  await drawer.getByRole('button', { exact: true, name: 'Close task' }).click();
  await page.reload();
  await page.getByRole('button', { exact: true, name: 'Open task: Build demo workflow 1' }).click();
  await expect(drawer.getByLabel(/^Effort/)).toHaveValue('7');

  const bob = await browser.newContext({ baseURL: process.env.FLOWBOARD_E2E_URL });
  try {
    const bobPage = await bob.newPage();
    await bobPage.goto('/login');
    await bobPage.getByLabel(/^Email/).fill('bob@example.com');
    await bobPage.getByLabel(/^Password/).fill('FlowboardDemo123!');
    await bobPage.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await bobPage.getByRole('button', { name: /Flowboard Demo/ }).click();
    await expect(
      bobPage.getByRole('button', { exact: true, name: 'Product backlog' }),
    ).toBeVisible();
    await expect(bobPage.getByRole('button', { exact: true, name: 'Private launch' })).toHaveCount(
      0,
    );
    await expect(bobPage.getByRole('button', { exact: true, name: 'Discovery' })).toHaveCount(0);
    await bobPage.getByRole('button', { exact: true, name: 'Product backlog' }).click();
    await bobPage
      .getByRole('button', { exact: true, name: 'Open task: Build demo workflow 1' })
      .click();
    const bobDrawer = bobPage.getByRole('dialog', { name: 'Task details' });
    await drawer.getByLabel(/^Effort/).fill('8');
    await bobDrawer.getByLabel(/^Effort/).fill('9');
    await Promise.all([
      // A saved write precedes the worker event and the receiving client's refetch.
      page.waitForResponse(
        async (response) =>
          response.request().method() === 'GET' &&
          /\/api\/v1\/tasks\/[^/]+$/.test(new URL(response.url()).pathname) &&
          response.ok() &&
          (await response.json()).data.customFields.effort === 9,
        { timeout: 15000 },
      ),
      bobDrawer.getByRole('button', { exact: true, name: 'Save changes' }).click(),
    ]);
    await expect(bobDrawer.getByRole('status', { exact: true, name: '' })).toContainText(
      'Task saved',
    );

    await expect(drawer.getByRole('alert')).toBeVisible();
    await expect(drawer.getByLabel(/^Effort/)).toHaveValue('8');
    await expect(drawer.getByRole('button', { exact: true, name: 'Save changes' })).toBeDisabled();
    await drawer.getByRole('button', { exact: true, name: 'Reload latest task' }).click();
    await page
      .getByRole('dialog', { name: 'Discard unsaved changes?' })
      .getByRole('button', { exact: true, name: 'Discard and reload' })
      .click();
    await expect(drawer.getByLabel(/^Effort/)).toHaveValue('9');
  } finally {
    await bob.close();
  }
});
