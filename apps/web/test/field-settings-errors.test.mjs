import test from 'node:test';

import { expect } from '@playwright/test';

import { selectAutocomplete } from './common/selectAutocomplete.mjs';
import { openSettings } from './common/status-settings-fixture.mjs';

test(
  'nested field errors focus the option and repeated submission sends one request',
  { timeout: 120000 },
  async (t) => {
    const { page } = await openSettings(t, 'Field');
    await selectAutocomplete(
      page.getByLabel('Configuration scope', { exact: true }),
      'Space: Engineering',
    );
    await page.getByRole('button', { exact: true, name: 'Edit Team' }).click();
    const form = page.getByRole('form', { name: 'Field editor' });
    await form.getByLabel(/^Option 2 label/).fill('Server rejected name');
    const pattern = '**/api/v1/scopes/*/*/fields/*';
    await page.route(pattern, (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Correct the option label.',
            details: [
              {
                code: 'invalid_value',
                path: ['options', 1, 'label'],
                message: 'Choose a supported label.',
              },
            ],
          },
        }),
      }),
    );
    await form.getByRole('button', { exact: true, name: 'Save field' }).click();
    await expect(form.getByLabel(/^Option 2 label/)).toBeFocused();
    await expect(form.getByLabel(/^Option 2 label/)).toHaveValue('Server rejected name');
    await expect(form.getByText('Choose a supported label.', { exact: true })).toBeVisible();
    await page.unroute(pattern);
    let release;
    let requests = 0;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    t.after(() => release());
    await page.route(pattern, async (route) => {
      requests++;
      await gate;
      await route.continue();
    });
    await form.evaluate((element) => {
      element.requestSubmit();
      element.requestSubmit();
    });
    await expect.poll(() => requests).toBe(1);
    await expect(form.getByRole('button', { exact: true, name: 'Saving…' })).toBeDisabled();
    await expect(page.getByLabel('Configuration scope', { exact: true })).toBeDisabled();
    release();
    await expect(page.getByRole('status', { exact: true, name: '' })).toContainText('Field saved');
  },
);
