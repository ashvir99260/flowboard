import { expect, test } from '@playwright/test';

import { login, openBacklog, selectAutocomplete } from './helpers';

test('subtasks persist, navigate safely and refresh another client on create and detach', async ({
  page,
  browser,
}) => {
  await login(page);
  await openBacklog(page);
  const other = await browser.newContext({ baseURL: process.env.FLOWBOARD_E2E_URL });
  try {
    const viewer = await other.newPage();
    await login(viewer, 'bob@example.com');
    await openBacklog(viewer);
    for (const client of [page, viewer])
      await client
        .getByRole('button', { exact: true, name: 'Open task: Build demo workflow 1' })
        .click();

    const drawer = page.getByRole('dialog', { name: 'Task details' });
    const viewerDrawer = viewer.getByRole('dialog', { name: 'Task details' });
    const children = viewerDrawer.getByRole('region', { exact: true, name: 'Subtasks' });
    await expect(children.getByText('No subtasks yet.', { exact: true })).toBeVisible();
    await drawer.getByRole('button', { exact: true, name: 'Add subtask' }).click();
    await drawer.getByLabel(/^Title/).fill('Browser verified subtask');
    await drawer.getByRole('button', { exact: true, name: 'Create task' }).click();
    await expect(drawer.getByLabel(/^Effort/)).toBeFocused();
    await drawer.getByLabel(/^Effort/).fill('0');
    await drawer.getByRole('button', { exact: true, name: 'Create task' }).click();
    await expect(drawer.getByText('Task created.', { exact: true })).toBeVisible();
    await expect(
      children.getByRole('button', { exact: true, name: 'Browser verified subtask' }),
    ).toBeVisible({ timeout: 15000 });
    await drawer.getByRole('button', { exact: true, name: 'Open parent task' }).click();
    await expect(drawer.getByLabel(/^Title/)).toHaveValue('Build demo workflow 1');
    await drawer
      .getByRole('region', { exact: true, name: 'Subtasks' })
      .getByRole('button', { exact: true, name: 'Browser verified subtask' })
      .click();
    await selectAutocomplete(drawer.getByLabel(/^Parent task/), 'Build demo workflow 5');
    await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
    await expect(drawer.getByText('Task saved.', { exact: true })).toBeVisible();
    await expect(children.getByText('No subtasks yet.', { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await viewerDrawer.getByRole('button', { exact: true, name: 'Close task' }).click();
    await viewer
      .getByRole('button', { exact: true, name: 'Open task: Build demo workflow 5' })
      .click();
    await children.getByRole('button', { exact: true, name: 'Browser verified subtask' }).click();
    await viewerDrawer.getByLabel(/^Title/).fill('Keep this remote draft');
    await selectAutocomplete(drawer.getByLabel(/^Parent task/), 'Build demo workflow 1');
    await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
    await expect(
      viewerDrawer.getByText('This task changed elsewhere. Your unsaved edits are preserved.', {
        exact: true,
      }),
    ).toBeVisible({ timeout: 15000 });
    await expect(viewerDrawer.getByLabel(/^Title/)).toHaveValue('Keep this remote draft');
    await expect(
      viewerDrawer.getByRole('button', { exact: true, name: 'Save changes' }),
    ).toBeDisabled();
    await viewerDrawer.getByRole('button', { exact: true, name: 'Reload latest task' }).click();
    await viewer
      .getByRole('dialog', { name: 'Discard unsaved changes?' })
      .getByRole('button', { exact: true, name: 'Discard and reload' })
      .click();
    await expect(viewerDrawer.getByLabel(/^Parent task/)).toHaveValue('Build demo workflow 1');
    await viewerDrawer.getByRole('button', { exact: true, name: 'Open parent task' }).click();
    await expect(
      children.getByRole('button', { exact: true, name: 'Browser verified subtask' }),
    ).toBeVisible();
    await expect(drawer.getByLabel(/^Effort/)).toHaveValue('0');
    await drawer.getByLabel(/^Title/).fill('Discard this title');
    await drawer.getByRole('button', { exact: true, name: 'Open parent task' }).click();
    await page
      .getByRole('dialog', { name: 'Discard unsaved changes?' })
      .getByRole('button', { exact: true, name: 'Cancel' })
      .click();
    await expect(drawer.getByLabel(/^Title/)).toHaveValue('Discard this title');
    await drawer.getByRole('button', { exact: true, name: 'Open parent task' }).click();
    await page
      .getByRole('dialog', { name: 'Discard unsaved changes?' })
      .getByRole('button', { exact: true, name: 'Discard changes' })
      .click();
    await drawer
      .getByRole('region', { exact: true, name: 'Subtasks' })
      .getByRole('button', { exact: true, name: 'Browser verified subtask' })
      .click();
    await selectAutocomplete(drawer.getByLabel(/^Parent task/), 'No parent (top-level task)');
    await drawer.getByRole('button', { exact: true, name: 'Save changes' }).click();
    await expect(drawer.getByText('Task saved.', { exact: true })).toBeVisible();
    await expect(children.getByText('No subtasks yet.', { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await drawer.getByRole('button', { exact: true, name: 'Close task' }).click();
    await page.reload();
    await expect(
      page.getByRole('button', { exact: true, name: 'Open task: Build demo workflow 1' }),
    ).toBeVisible();
    await page
      .getByRole('button', { exact: true, name: 'Open task: Browser verified subtask' })
      .click();
    await expect(drawer.getByRole('button', { exact: true, name: 'Open parent task' })).toHaveCount(
      0,
    );
    await expect(drawer.getByRole('button', { exact: true, name: 'Add subtask' })).toBeVisible();
  } finally {
    await other.close();
  }
});
