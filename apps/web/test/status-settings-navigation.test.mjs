import test from 'node:test';

import { expect } from '@playwright/test';

import { openSettings } from './common/status-settings-fixture.mjs';

test(
  'status drafts survive list navigation and browser history within the workspace',
  { timeout: 120000 },
  async (t) => {
    const { page } = await openSettings(t);
    await page.getByRole('button', { exact: true, name: 'Edit In progress' }).click();
    await page.getByLabel(/^Status name/).fill('Unfinished status edit');
    await page.getByRole('button', { exact: true, name: 'Product backlog' }).click();
    await expect(page.getByRole('heading', { exact: true, name: 'Product backlog' })).toBeVisible();
    await expect(page.getByLabel(/^Status name/)).toBeHidden();
    await page.goBack();
    await expect(page.getByLabel(/^Status name/)).toHaveValue('Unfinished status edit');
    await page.goForward();
    await page.getByRole('link', { exact: true, name: 'Status settings' }).click();
    await expect(page.getByLabel(/^Status name/)).toHaveValue('Unfinished status edit');
  },
);

test(
  'a retained status draft detects another administrator change and reloads explicitly',
  { timeout: 120000 },
  async (t) => {
    const { page, browser, app } = await openSettings(t);
    await page.getByRole('button', { exact: true, name: 'Edit In progress' }).click();
    await page.getByLabel(/^Status name/).fill('Keep this conflicting draft');
    await page.getByRole('button', { exact: true, name: 'Product backlog' }).click();
    const context = await browser.newContext();
    try {
      const other = await context.newPage();
      await other.goto(`${app.origin}/login`);
      await other.getByLabel(/^Email/).fill('alice@example.com');
      await other.getByLabel(/^Password/).fill('FlowboardDemo123!');
      await other.getByRole('button', { exact: true, name: 'Sign in' }).click();
      await other.getByRole('button', { name: /Flowboard Demo/ }).click();
      await other.getByRole('link', { exact: true, name: 'Status settings' }).click();
      await other.getByRole('button', { exact: true, name: 'Edit In progress' }).click();
      await other.getByLabel(/^Status name/).fill('Working');
      await other.getByRole('button', { exact: true, name: 'Save status' }).click();
      await expect(other.getByRole('status', { exact: true, name: '' })).toContainText(
        'Status saved',
      );
      await page.getByRole('link', { exact: true, name: 'Status settings' }).click();
      await expect(page.getByLabel(/^Status name/)).toHaveValue('Keep this conflicting draft');
      await page.getByRole('button', { exact: true, name: 'Save status' }).click();
      await expect(
        page.getByRole('form', { name: 'Status editor' }).getByRole('alert'),
      ).toBeVisible();
      await expect(page.getByRole('button', { exact: true, name: 'Save status' })).toBeDisabled();
      await page.getByRole('button', { exact: true, name: 'Reload configuration' }).click();
      await page
        .getByRole('dialog', { name: 'Discard unsaved changes?' })
        .getByRole('button', { exact: true, name: 'Discard and reload' })
        .click();
      await expect(
        page
          .getByRole('region', { exact: true, name: 'Effective status preview' })
          .getByText(/^Working ·/),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  },
);

test(
  'status confirmations suspend with the inactive settings page without losing the draft',
  { timeout: 120000 },
  async (t) => {
    const { page } = await openSettings(t);
    await page.getByRole('button', { exact: true, name: 'Edit In progress' }).click();
    await page.getByLabel(/^Status name/).fill('Retained behind confirmation');
    await page.getByRole('button', { exact: true, name: 'Cancel editing' }).click();
    const confirmation = page.getByRole('dialog', {
      exact: true,
      name: 'Discard unsaved changes?',
    });
    await expect(confirmation).toBeVisible();
    await page.goBack();
    await expect(confirmation).toBeHidden();
    await page.goForward();
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { exact: true, name: 'Cancel' }).click();
    await expect(page.getByLabel(/^Status name/)).toHaveValue('Retained behind confirmation');
  },
);
