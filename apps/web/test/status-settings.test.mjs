import test from 'node:test';

import { expect } from '@playwright/test';

import { selectAutocomplete } from './common/selectAutocomplete.mjs';
import { openSettings } from './common/status-settings-fixture.mjs';

test(
  'status settings read the workspace and inherited list configuration',
  { timeout: 120000 },
  async (t) => {
    const { page } = await openSettings(t);
    await expect(page.getByRole('heading', { exact: true, name: 'Status settings' })).toBeVisible();
    const preview = page.getByRole('region', { exact: true, name: 'Effective status preview' });
    await expect(preview.getByText(/^To do ·/)).toBeVisible();
    await expect(preview.getByText(/^In progress ·/)).toBeVisible();
    await selectAutocomplete(
      page.getByLabel('Configuration scope', { exact: true }),
      'Folder: Delivery',
    );
    await expect(preview.getByText(/^In progress ·/)).toBeVisible();
    await selectAutocomplete(
      page.getByLabel('Configuration scope', { exact: true }),
      'List: Private launch',
    );
    await expect(preview.getByText(/^In review ·/)).toBeVisible();
    await expect(preview.getByText(/^Blocked ·/)).toBeVisible();
    await expect(
      page
        .getByRole('region', { exact: true, name: 'Status configuration' })
        .getByText('Inherited', { exact: true }),
    ).not.toHaveCount(0);
  },
);

test(
  'editing an inherited status keeps identity and updates descendants without changing a sibling override',
  { timeout: 120000 },
  async (t) => {
    const { page } = await openSettings(t);
    await selectAutocomplete(
      page.getByLabel('Configuration scope', { exact: true }),
      'Space: Engineering',
    );
    await page.getByRole('button', { exact: true, name: 'Edit In progress' }).click();
    await page.getByLabel(/^Status name/).fill('Building');
    await expect(
      page
        .getByRole('region', { exact: true, name: 'Draft status preview' })
        .getByText(/^Building ·/),
    ).toBeVisible();
    const saved = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().endsWith('/statuses'),
    );
    await page.getByRole('button', { exact: true, name: 'Save status' }).click();
    const mutation = await (await saved).json();
    await expect(page.getByRole('status', { exact: true, name: '' })).toContainText('Status saved');
    await selectAutocomplete(
      page.getByLabel('Configuration scope', { exact: true }),
      'List: Product backlog',
    );
    await expect(
      page
        .getByRole('region', { exact: true, name: 'Effective status preview' })
        .getByText(/^Building ·/),
    ).toBeVisible();
    await selectAutocomplete(
      page.getByLabel('Configuration scope', { exact: true }),
      'List: Private launch',
    );
    await expect(
      page
        .getByRole('region', { exact: true, name: 'Effective status preview' })
        .getByText(/^In review ·/),
    ).toBeVisible();
    await page.getByRole('button', { exact: true, name: 'Edit In review' }).click();
    await page.getByLabel(/^Status name/).fill('');
    const inherited = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' && response.url().includes('/statuses/'),
    );
    await page.getByRole('button', { exact: true, name: 'Save status' }).click();
    const inheritedMutation = await (await inherited).json();
    await expect(page.getByRole('status', { exact: true, name: '' })).toContainText('Status saved');
    if (mutation.data.identity.id !== inheritedMutation.data.identity.id)
      throw new Error('Rename changed canonical status identity');

    await expect(
      page
        .getByRole('region', { exact: true, name: 'Effective status preview' })
        .getByText(/^Building ·/),
    ).toBeVisible();
    await page.getByRole('button', { exact: true, name: 'Edit Building' }).click();
    await page.getByRole('button', { exact: true, name: 'Remove local override' }).click();
    await page
      .getByRole('dialog', { name: 'Remove local status configuration?' })
      .getByRole('button', { exact: true, name: 'Remove configuration' })
      .click();
    await expect(
      page
        .getByRole('region', { exact: true, name: 'Status doing' })
        .getByText('Inherited', { exact: true }),
    ).toBeVisible();
  },
);

test(
  'a list can add, hide, restore and delete its own unused status',
  { timeout: 120000 },
  async (t) => {
    const { page } = await openSettings(t);
    const preview = page.getByRole('region', { exact: true, name: 'Effective status preview' });
    await selectAutocomplete(
      page.getByLabel('Configuration scope', { exact: true }),
      'List: Product backlog',
    );
    await page.getByRole('button', { exact: true, name: 'Add status' }).click();
    await page.getByLabel(/^Status key/).fill('paused');
    await selectAutocomplete(page.getByLabel(/^Status category/), 'closed');
    await page.getByLabel(/^Status name/).fill('Paused');
    await page.getByLabel(/^Status color/).fill('#334455');
    await page.getByLabel(/^Status position/).fill('5');
    await page.getByRole('button', { exact: true, name: 'Save status' }).click();
    await expect(preview.getByText(/^Paused ·/)).toBeVisible();
    await page.getByRole('button', { exact: true, name: 'Edit Paused' }).click();
    await selectAutocomplete(page.getByLabel('Status visibility', { exact: true }), 'Hide status');
    await page.getByRole('button', { exact: true, name: 'Save status' }).click();
    await expect(preview.getByText(/^Paused ·/)).toHaveCount(0);
    await expect(
      page
        .getByRole('region', { exact: true, name: 'Status paused' })
        .getByText('Hidden', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { exact: true, name: 'Edit Paused' }).click();
    await selectAutocomplete(page.getByLabel('Status visibility', { exact: true }), 'Show status');
    await page.getByRole('button', { exact: true, name: 'Save status' }).click();
    await expect(preview.getByText(/^Paused ·/)).toBeVisible();
    await page.getByRole('button', { exact: true, name: 'Edit Paused' }).click();
    await page.getByRole('button', { exact: true, name: 'Delete status' }).click();
    await page
      .getByRole('dialog', { name: 'Remove local status configuration?' })
      .getByRole('button', { exact: true, name: 'Remove configuration' })
      .click();
    await expect(preview.getByText(/^Paused ·/)).toHaveCount(0);
    await expect(page.getByRole('region', { exact: true, name: 'Status paused' })).toHaveCount(0);
  },
);
