import { expect, test } from '@playwright/test';

import { login, openBacklog, selectAutocomplete } from './helpers';

import type { Page } from '@playwright/test';

const editor = (page: Page) => page.getByRole('form', { name: 'Administration editor' });

async function createContainer(
  page: Page,
  name: string,
  type: 'space' | 'folder' | 'list',
  parentLabel?: string,
  visibility = 'public',
) {
  await page.getByRole('button', { exact: true, name: 'New container' }).click();
  await editor(page)
    .getByLabel(/^Container name/)
    .fill(name);
  await selectAutocomplete(
    editor(page).getByLabel(/^Container type/),
    type[0]!.toUpperCase() + type.slice(1),
  );
  if (parentLabel)
    await selectAutocomplete(editor(page).getByLabel(/^Parent container/), parentLabel);

  await selectAutocomplete(
    editor(page).getByLabel(/^Visibility/),
    visibility === 'private' ? 'Private: explicit allow required' : 'Public to workspace members',
  );
  const response = page.waitForResponse(
    (item) =>
      item.request().method() === 'POST' && new URL(item.url()).pathname === '/api/v1/nodes',
  );
  await editor(page).getByRole('button', { exact: true, name: 'Create container' }).click();
  const saved = await response;
  expect(saved.status()).toBe(201);
  const id = (await saved.json()).data.id as string;
  await expect(page.getByLabel(/^Selected container/)).toHaveValue(new RegExp(name));
  await expect(editor(page).getByLabel(/^Container name/)).toHaveValue(name);

  return id;
}

test('administrators arrange containers and manage allow, deny and removed grants through the UI', async ({
  page,
  browser,
}) => {
  await login(page);
  await openBacklog(page);
  await page.getByRole('link', { exact: true, name: 'Containers and access' }).click();
  const space = await createContainer(page, 'Admin browser space', 'space');
  await createContainer(page, 'Admin browser folder', 'folder', 'space: Admin browser space');
  const list = await createContainer(
    page,
    'Admin browser list',
    'list',
    'folder: Admin browser space / Admin browser folder',
    'private',
  );

  const context = await browser.newContext({ baseURL: process.env.FLOWBOARD_E2E_URL });
  try {
    const bob = await context.newPage();
    await login(bob, 'bob@example.com');
    await expect(bob.getByRole('button', { exact: true, name: 'Admin browser list' })).toHaveCount(
      0,
    );

    for (const mode of ['deny', 'allow', 'none']) {
      await page.getByRole('button', { name: /^Edit access for Bob/ }).click();
      const accessLabel =
        mode === 'none' ? 'No explicit grant' : mode === 'allow' ? 'Allow' : 'Deny';
      await selectAutocomplete(editor(page).getByLabel(/^Explicit access/), accessLabel);
      const response = page.waitForResponse(
        (item) =>
          new URL(item.url()).pathname.startsWith(`/api/v1/nodes/${list}/grants`) &&
          item.request().method() === (mode === 'none' ? 'DELETE' : 'PUT'),
      );
      await editor(page).getByRole('button', { exact: true, name: 'Save access' }).click();
      expect((await response).status()).toBe(mode === 'none' ? 204 : 200);
      await expect(editor(page).getByLabel(/^Explicit access/)).toHaveValue(accessLabel);
      await bob.reload();
      if (mode === 'allow')
        await expect(
          bob.getByRole('button', { exact: true, name: 'Admin browser list' }),
        ).toBeVisible();
      else
        await expect(
          bob.getByRole('button', { exact: true, name: 'Admin browser list' }),
        ).toHaveCount(0);
    }
  } finally {
    await context.close();
  }

  await page.getByRole('button', { exact: true, name: 'Edit details' }).click();
  await editor(page)
    .getByLabel(/^Container name/)
    .fill('Kept unsaved name');
  await page.getByRole('button', { exact: true, name: 'New container' }).click();
  await page
    .getByRole('dialog', { name: 'Discard unsaved changes?' })
    .getByRole('button', { exact: true, name: 'Cancel' })
    .click();
  await expect(editor(page).getByLabel(/^Container name/)).toHaveValue('Kept unsaved name');
  await editor(page).getByRole('button', { exact: true, name: 'Save container' }).click();
  await expect(page.getByLabel(/^Selected container/)).toHaveValue(/Kept unsaved name/);

  await createContainer(
    page,
    'Admin browser sibling',
    'list',
    'folder: Admin browser space / Admin browser folder',
  );
  const reordered = page.waitForResponse(
    (item) => item.request().method() === 'POST' && item.url().endsWith('/reorder'),
  );
  await page.getByRole('button', { exact: true, name: 'Move container up' }).click();
  expect((await reordered).status()).toBe(200);
  await expect(page.getByRole('button', { exact: true, name: 'Move container up' })).toBeDisabled();

  await page.getByRole('button', { exact: true, name: 'Change parent' }).click();
  const parent = editor(page).getByLabel(/^Parent container/);
  const current = await parent.inputValue();
  await parent.click();
  await parent.fill('');
  const destination = (await page.getByRole('option').allTextContents()).find(
    (label) => label !== current && label !== 'Choose a parent',
  );
  expect(destination).toBeTruthy();
  await selectAutocomplete(parent, destination!);
  const moved = page.waitForResponse(
    (item) => item.request().method() === 'POST' && item.url().endsWith('/move'),
  );
  await editor(page).getByRole('button', { exact: true, name: 'Move container' }).click();
  expect((await moved).status()).toBe(200);

  await selectAutocomplete(page.getByLabel(/^Selected container/), 'space: Admin browser space');
  await page.getByRole('button', { exact: true, name: 'Archive container' }).click();
  const dialog = page.getByRole('dialog', { name: 'Archive container and descendants?' });
  await dialog.getByRole('button', { exact: true, name: 'Cancel' }).click();
  await expect(page.getByLabel(/^Selected container/)).toHaveValue('space: Admin browser space');
  await page.getByRole('button', { exact: true, name: 'Archive container' }).click();
  const archived = page.waitForResponse(
    (item) =>
      item.request().method() === 'DELETE' &&
      new URL(item.url()).pathname === `/api/v1/nodes/${space}`,
  );
  await dialog.getByRole('button', { exact: true, name: 'Archive subtree' }).click();
  expect((await archived).status()).toBe(204);
  await page.getByLabel(/^Selected container/).click();
  await page.getByLabel(/^Selected container/).fill('Admin browser space');
  await expect(
    page.getByRole('option', { exact: true, name: 'space: Admin browser space' }),
  ).toHaveCount(0);
});

test('members cannot open administration controls through a direct URL', async ({ page }) => {
  await login(page, 'bob@example.com');
  await openBacklog(page);
  await expect(page.getByRole('link', { exact: true, name: 'Containers and access' })).toHaveCount(
    0,
  );
  const workspace = new URL(page.url()).pathname.split('/')[2];
  await page.goto(`/w/${workspace}/settings/administration`);
  await expect(
    page.getByText('Only workspace administrators can manage containers and grants.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(editor(page)).toHaveCount(0);
});

test('remote configuration changes preserve the dirty administration draft until explicit reload', async ({
  page,
  browser,
}) => {
  await login(page);
  await openBacklog(page);
  await page.getByRole('link', { exact: true, name: 'Containers and access' }).click();
  const nodeId = await createContainer(page, 'Conflict preview space', 'space');
  await editor(page)
    .getByLabel(/^Container name/)
    .fill('Keep my unsaved name');
  await page.getByRole('link', { exact: true, name: 'Field settings' }).click();
  await page.getByRole('link', { exact: true, name: 'Containers and access' }).click();
  await expect(editor(page).getByLabel(/^Container name/)).toHaveValue('Keep my unsaved name');
  const origin = new URL(page.url()).origin;
  const other = await browser.newContext({ extraHTTPHeaders: { Origin: origin } });
  try {
    const session = await other.request.post(`${origin}/api/v1/auth/login`, {
      data: { email: 'alice@example.com', password: 'FlowboardDemo123!' },
    });
    expect(session.status()).toBe(200);
    const token = (await session.json()).data.accessToken as string;
    const headers = { Authorization: `Bearer ${token}` };
    const response = await other.request.get(`${origin}/api/v1/nodes/${nodeId}`, { headers });
    const current = await response.json();
    const changed = await other.request.patch(`${origin}/api/v1/nodes/${nodeId}`, {
      headers,
      data: {
        name: 'Remote saved name',
        expectedConfigVersion: current.configVersion,
        expectedVersion: current.data.version,
      },
    });
    expect(changed.status()).toBe(200);
    await expect(
      editor(page).getByText('Configuration changed. Your draft is kept; reload before saving.', {
        exact: true,
      }),
    ).toBeVisible({ timeout: 15000 });
    await expect(editor(page).getByLabel(/^Container name/)).toHaveValue('Keep my unsaved name');
    await expect(
      editor(page).getByRole('button', { exact: true, name: 'Save container' }),
    ).toBeDisabled();
    await editor(page).getByRole('button', { exact: true, name: 'Reload administration' }).click();
    await page
      .getByRole('dialog', { name: 'Discard unsaved changes?' })
      .getByRole('button', { exact: true, name: 'Discard and continue' })
      .click();
    await expect(editor(page).getByLabel(/^Container name/)).toHaveValue('Remote saved name');
  } finally {
    await other.close();
  }
});
