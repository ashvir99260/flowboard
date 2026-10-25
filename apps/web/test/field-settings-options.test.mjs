import assert from 'node:assert/strict';
import test from 'node:test';

import { expect } from '@playwright/test';

import { openSettings } from './common/status-settings-fixture.mjs';

const choose = (page, label) =>
  page.getByLabel('Configuration scope', { exact: true }).selectOption({ label });

test(
  'local field copies preserve option IDs across reorder, rename and safe removal',
  { timeout: 120000 },
  async (t) => {
    const { page } = await openSettings(t, 'Field');
    await choose(page, 'List: Product backlog');
    const teamInput = page
      .getByRole('region', { exact: true, name: 'Effective field preview' })
      .getByLabel(/^Team/);
    await expect(teamInput).toBeVisible();
    const originalIds = await teamInput
      .locator('option')
      .evaluateAll((options) => options.map((option) => option.value).filter(Boolean));
    await page.getByRole('button', { exact: true, name: 'Edit Team' }).click();
    const form = page.getByRole('form', { name: 'Field editor' });
    await form.getByRole('button', { exact: true, name: 'Move option 1 down' }).click();
    await expect(form.getByLabel(/^Option 2 label/)).toBeFocused();
    await form.getByLabel(/^Option 2 label/).fill('Interface');
    const create = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().endsWith('/fields'),
    );
    await form.getByRole('button', { exact: true, name: 'Save field' }).click();
    const response = await create;
    assert.equal(response.status(), 201);
    const copied = (await response.json()).data;
    assert.deepEqual(
      copied.options.map(({ id }) => id),
      originalIds.toReversed(),
    );
    await expect(page.getByRole('status', { exact: true, name: '' })).toContainText('Field saved');
    await page.getByRole('button', { exact: true, name: 'Edit Team' }).click();
    await form.getByRole('button', { exact: true, name: 'Remove option 1' }).click();
    await form.getByRole('button', { exact: true, name: 'Save field' }).click();
    await expect(form.getByRole('alert')).toContainText('invalidate');
    await expect(form.getByLabel(/^Option 1 label/)).toHaveValue('Interface');
    await form.getByRole('button', { exact: true, name: 'Cancel editing' }).click();
    await page
      .getByRole('dialog', { name: 'Discard unsaved changes?' })
      .getByRole('button', { exact: true, name: 'Discard changes' })
      .click();
    await page.getByRole('button', { exact: true, name: 'Edit Team' }).click();
    await form.getByRole('button', { exact: true, name: 'Remove local override' }).click();
    await page
      .getByRole('dialog', { name: 'Remove local field configuration?' })
      .getByRole('button', { exact: true, name: 'Remove configuration' })
      .click();
    await expect(
      page
        .getByRole('region', { exact: true, name: 'Field team' })
        .getByText('Inherited', { exact: true }),
    ).toBeVisible();
    await choose(page, 'List: Private launch');
    await expect(page.getByRole('button', { exact: true, name: 'Edit Launch team' })).toBeVisible();
  },
);

test(
  'required promotion, type change and in-use deletion retain failed field drafts',
  { timeout: 120000 },
  async (t) => {
    const { page } = await openSettings(t, 'Field');
    const form = page.getByRole('form', { name: 'Field editor' });
    await page.getByRole('button', { exact: true, name: 'Edit Effort' }).click();
    await form.getByLabel(/^Field type/).selectOption('text');
    await form.getByRole('button', { exact: true, name: 'Save field' }).click();
    await expect(form.getByRole('alert')).toContainText('invalidate');
    await expect(form.getByLabel(/^Field type/)).toHaveValue('text');
    await form.getByRole('button', { exact: true, name: 'Delete field' }).click();
    await page
      .getByRole('dialog', { name: 'Remove local field configuration?' })
      .getByRole('button', { exact: true, name: 'Remove configuration' })
      .click();
    await expect(form.getByRole('alert')).toContainText('invalidate');
    await form.getByRole('button', { exact: true, name: 'Cancel editing' }).click();
    await page
      .getByRole('dialog', { name: 'Discard unsaved changes?' })
      .getByRole('button', { exact: true, name: 'Discard changes' })
      .click();
    await choose(page, 'Folder: Delivery');
    await page.getByRole('button', { exact: true, name: 'Edit Release date' }).click();
    await form.getByRole('checkbox', { name: 'Require a value on every task' }).check();
    await form.getByRole('button', { exact: true, name: 'Save field' }).click();
    await expect(form.getByRole('alert')).toContainText('invalidate');
    await expect(
      form.getByRole('checkbox', { name: 'Require a value on every task' }),
    ).toBeChecked();
  },
);

test(
  'option color can be cleared and stays absent after save and reload',
  { timeout: 120000 },
  async (t) => {
    const { page } = await openSettings(t, 'Field');
    await choose(page, 'List: Product backlog');
    await page.getByRole('button', { exact: true, name: 'Edit Team' }).click();
    const form = page.getByRole('form', { name: 'Field editor' });
    await form.getByLabel(/^Option 1 color/).fill('');
    const save = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().endsWith('/fields'),
    );
    await form.getByRole('button', { exact: true, name: 'Save field' }).click();
    const response = await save;
    assert.equal(response.status(), 201);
    assert.equal(Object.hasOwn((await response.json()).data.options[0], 'color'), false);
    await page.reload();
    await choose(page, 'List: Product backlog');
    await page.getByRole('button', { exact: true, name: 'Edit Team' }).click();
    await expect(form.getByLabel(/^Option 1 color/)).toHaveValue('');
    await form.getByRole('button', { exact: true, name: 'Save field' }).click();
    await expect(form.getByText('No changes to save.', { exact: true })).toBeVisible();
  },
);
