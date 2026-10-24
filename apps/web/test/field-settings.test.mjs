import test from 'node:test';

import { expect } from '@playwright/test';

import { openSettings } from './common/status-settings-fixture.mjs';

test(
  'field settings show inherited definitions and create every field type',
  { timeout: 120000 },
  async (t) => {
    const { page } = await openSettings(t, 'Field');
    await expect(page.getByRole('heading', { exact: true, name: 'Field settings' })).toBeVisible();
    await page
      .getByLabel('Configuration scope', { exact: true })
      .selectOption({ label: 'List: Product backlog' });
    await expect(
      page
        .getByRole('region', { exact: true, name: 'Field effort' })
        .getByText('Inherited', { exact: true }),
    ).toBeVisible();
    for (const type of ['text', 'number', 'single_select', 'multi_select', 'date', 'checkbox']) {
      await page.getByRole('button', { exact: true, name: 'Add field' }).click();
      const editor = page.getByRole('form', { name: 'Field editor' });
      await editor.getByLabel(/^Field key/).fill(`test_${type}`);
      await editor.getByLabel(/^Field name/).fill(`Test ${type}`);
      await editor.getByLabel(/^Field type/).selectOption(type);
      if (type.includes('select')) {
        await editor.getByRole('button', { exact: true, name: 'Add option' }).click();
        await editor.getByLabel(/^Option 1 label/).fill('One');
      }

      await editor.getByRole('button', { exact: true, name: 'Save field' }).click();
      await expect(page.getByRole('status')).toContainText('Field saved');
      await expect(
        page.getByRole('region', { exact: true, name: `Field test_${type}` }),
      ).toBeVisible();
    }
    await page.getByRole('button', { exact: true, name: 'Edit Test text' }).click();
    await page.getByRole('button', { exact: true, name: 'Delete field' }).click();
    const removed = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        /\/fields\/[^/]+$/.test(new URL(response.url()).pathname),
    );
    await page
      .getByRole('dialog', { name: 'Remove local field configuration?' })
      .getByRole('button', { exact: true, name: 'Remove configuration' })
      .click();
    expect((await removed).status()).toBe(204);
    await expect(
      page.getByRole('dialog', { name: 'Remove local field configuration?' }),
    ).toHaveCount(0);
    await expect(page.getByRole('region', { exact: true, name: 'Field test_text' })).toHaveCount(0);
    await page.reload();
    await page
      .getByLabel('Configuration scope', { exact: true })
      .selectOption({ label: 'List: Product backlog' });
    await expect(
      page.getByRole('region', { exact: true, name: 'Field test_checkbox' }),
    ).toBeVisible();
    await expect(page.getByRole('region', { exact: true, name: 'Field test_text' })).toHaveCount(0);
  },
);
