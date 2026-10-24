import test from 'node:test';

import { expect } from '@playwright/test';

import { openSettings } from './common/status-settings-fixture.mjs';

test(
  'required categories and in-use status removal are safe and failed writes preserve edits',
  { timeout: 120000 },
  async (t) => {
    const { page } = await openSettings(t);
    await page.getByRole('button', { exact: true, name: 'Edit In progress' }).click();
    await page
      .getByLabel('Status visibility', { exact: true })
      .selectOption({ label: 'Hide status' });
    await expect(
      page.getByRole('region', { exact: true, name: 'Draft status preview' }).getByRole('alert'),
    ).toContainText('active');
    await expect(page.getByRole('button', { exact: true, name: 'Save status' })).toBeDisabled();
    await page.getByRole('button', { exact: true, name: 'Cancel editing' }).click();
    await page
      .getByRole('dialog', { name: 'Discard unsaved changes?' })
      .getByRole('button', { exact: true, name: 'Discard changes' })
      .click();
    await page.getByRole('button', { exact: true, name: 'Edit Closed' }).click();
    await page.getByLabel(/^Status name/).fill('Keep this draft');
    await page.getByRole('button', { exact: true, name: 'Delete status' }).click();
    const response = page.waitForResponse(
      (item) => item.request().method() === 'DELETE' && item.url().includes('/statuses/'),
    );
    await page
      .getByRole('dialog', { name: 'Remove local status configuration?' })
      .getByRole('button', { exact: true, name: 'Remove configuration' })
      .click();
    if ((await response).ok()) throw new Error('In-use status removal unexpectedly succeeded');

    await expect(page.getByLabel(/^Status name/)).toHaveValue('Keep this draft');
    await expect(
      page.getByRole('form', { name: 'Status editor' }).getByRole('alert'),
    ).toBeVisible();
    await expect(
      page
        .getByRole('region', { exact: true, name: 'Effective status preview' })
        .getByText(/^Closed ·/),
    ).toBeVisible();
  },
);

test(
  'dirty scope changes require confirmation and members cannot open an editor',
  { timeout: 120000 },
  async (t) => {
    const { page, browser, app } = await openSettings(t);
    await page.getByRole('button', { exact: true, name: 'Edit In progress' }).click();
    await page.getByLabel(/^Status name/).fill('Do not discard');
    await page
      .getByLabel('Configuration scope', { exact: true })
      .selectOption({ label: 'Space: Engineering' });
    const confirm = page.getByRole('dialog', { name: 'Discard unsaved status changes?' });
    await confirm.getByRole('button', { exact: true, name: 'Cancel' }).click();
    await expect(page.getByLabel(/^Status name/)).toHaveValue('Do not discard');
    await page
      .getByLabel('Configuration scope', { exact: true })
      .selectOption({ label: 'Space: Engineering' });
    await confirm.getByRole('button', { exact: true, name: 'Discard and change scope' }).click();
    await expect(page.getByRole('form', { name: 'Status editor' })).toHaveCount(0);
    const context = await browser.newContext();
    try {
      const bob = await context.newPage();
      await bob.goto(`${app.origin}/login`);
      await bob.getByLabel(/^Email/).fill('bob@example.com');
      await bob.getByLabel(/^Password/).fill('FlowboardDemo123!');
      await bob.getByRole('button', { exact: true, name: 'Sign in' }).click();
      await bob.getByRole('button', { name: /Flowboard Demo/ }).click();
      await expect(bob.getByRole('link', { exact: true, name: 'Status settings' })).toHaveCount(0);
      await bob.goto(page.url());
      await expect(bob.getByRole('alert', { exact: true, name: 'Access denied' })).toBeVisible();
      await expect(bob.getByRole('button', { exact: true, name: 'Add status' })).toHaveCount(0);
    } finally {
      await context.close();
    }
  },
);

test(
  'server field errors retain drafts and focus while pending writes cannot duplicate',
  { timeout: 120000 },
  async (t) => {
    const { page } = await openSettings(t);
    await page.getByRole('button', { exact: true, name: 'Edit In progress' }).click();
    await page.getByLabel(/^Status name/).fill('Working');
    const pattern = '**/api/v1/scopes/**/statuses/*';
    await page.route(pattern, (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Check the marked fields.',
            details: [
              { code: 'invalid_format', path: ['color'], message: 'Choose a supported color.' },
            ],
          },
        }),
      }),
    );
    await page.getByRole('button', { exact: true, name: 'Save status' }).click();
    await expect(page.getByLabel(/^Status color/)).toBeFocused();
    await expect(page.getByLabel(/^Status name/)).toHaveValue('Working');
    await expect(page.getByText('Choose a supported color.', { exact: true })).toBeVisible();
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
    await page.getByRole('form', { name: 'Status editor' }).evaluate((form) => {
      form.requestSubmit();
      form.requestSubmit();
    });
    await expect.poll(() => requests).toBe(1);
    await expect(page.getByRole('button', { exact: true, name: 'Saving…' })).toBeDisabled();
    await expect(page.getByLabel('Configuration scope', { exact: true })).toBeDisabled();
    release();
    await expect(page.getByRole('status')).toContainText('Status saved');
  },
);
