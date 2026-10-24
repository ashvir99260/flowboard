import test from 'node:test';

import { expect } from '@playwright/test';

import { openSettings } from './common/status-settings-fixture.mjs';

test(
  'field drafts survive navigation and inactive confirmations cannot trap focus',
  { timeout: 120000 },
  async (t) => {
    const { page } = await openSettings(t, 'Field');
    await page.getByRole('button', { exact: true, name: 'Edit Effort' }).click();
    await page.getByLabel(/^Field name/).fill('Pending effort');
    await page.getByRole('link', { exact: true, name: 'Status settings' }).click();
    await expect(page.getByLabel(/^Field name/)).toBeHidden();
    await page.goBack();
    await expect(page.getByLabel(/^Field name/)).toHaveValue('Pending effort');
    await page
      .getByRole('combobox', { exact: true, name: 'Configuration scope' })
      .selectOption({ label: 'Folder: Delivery' });
    const changeScope = page.getByRole('dialog', { name: 'Discard unsaved field changes?' });
    await expect(changeScope).toBeVisible();
    await changeScope.getByRole('button', { exact: true, name: 'Cancel' }).click();
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
    await expect(page.getByLabel(/^Field name/)).toHaveValue('Pending effort');
  },
);

test(
  'concurrent field edits keep the dirty draft until explicit reload',
  { timeout: 120000 },
  async (t) => {
    const { page, browser, app } = await openSettings(t, 'Field');
    await page.getByRole('button', { exact: true, name: 'Edit Effort' }).click();
    await page.getByLabel(/^Field name/).fill('My unsaved effort');
    const context = await browser.newContext();
    try {
      const other = await context.newPage();
      await other.goto(`${app.origin}/login`);
      await other.getByLabel(/^Email/).fill('alice@example.com');
      await other.getByLabel(/^Password/).fill('FlowboardDemo123!');
      await other.getByRole('button', { exact: true, name: 'Sign in' }).click();
      await other.getByRole('button', { name: /Flowboard Demo/ }).click();
      await other.getByRole('link', { exact: true, name: 'Field settings' }).click();
      await other.getByRole('button', { exact: true, name: 'Edit Effort' }).click();
      await other.getByLabel(/^Field name/).fill('Saved effort');
      await other.getByRole('button', { exact: true, name: 'Save field' }).click();
      await expect(other.getByRole('status', { exact: true, name: '' })).toContainText(
        'Field saved',
      );
      await page.getByRole('button', { exact: true, name: 'Save field' }).click();
      await expect(page.getByRole('button', { exact: true, name: 'Save field' })).toBeDisabled();
      await expect(page.getByLabel(/^Field name/)).toHaveValue('My unsaved effort');
      await page.getByRole('button', { exact: true, name: 'Reload configuration' }).click();
      await page
        .getByRole('dialog', { name: 'Discard unsaved changes?' })
        .getByRole('button', { exact: true, name: 'Discard and reload' })
        .click();
      await expect(
        page.getByRole('button', { exact: true, name: 'Edit Saved effort' }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  },
);
