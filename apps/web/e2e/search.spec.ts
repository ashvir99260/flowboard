import { expect, test } from '@playwright/test';

import { login, openBacklog } from './helpers';

test('search composes with sorting and filters and survives reload and navigation', async ({
  page,
}) => {
  await login(page);
  await openBacklog(page);
  await page.getByRole('link', { exact: true, name: 'List view' }).click();
  await page
    .getByRole('textbox', { exact: true, name: 'Search tasks' })
    .fill('"Build demo workflow 1"');
  await page.getByRole('button', { exact: true, name: 'Search' }).click();
  await expect(page.getByText('1 loaded tasks', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { exact: true, name: 'Open task: Build demo workflow 1' }),
  ).toBeVisible();
  await page.getByRole('columnheader', { exact: true, name: 'Priority' }).click();
  expect(new URL(page.url()).searchParams.get('q')).toBe('"Build demo workflow 1"');
  await page.getByRole('button', { exact: true, name: 'Filters' }).click();
  await page.getByRole('combobox', { exact: true, name: 'Column' }).click();
  await page.getByRole('option', { exact: true, name: 'Effort' }).click();
  await page.getByRole('spinbutton', { exact: true, name: 'Value' }).fill('1');
  await expect.poll(() => new URL(page.url()).searchParams.get('fieldValue')).toBe('1');
  await page.reload();
  await expect(page.getByRole('textbox', { exact: true, name: 'Search tasks' })).toHaveValue(
    '"Build demo workflow 1"',
  );
  await expect(page.getByText('1 loaded tasks', { exact: true })).toBeVisible();
  await page.getByRole('button', { exact: true, name: 'Filters' }).click();
  await page.getByRole('button', { exact: true, name: 'Delete' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has('fieldKey')).toBe(false);
  await page.keyboard.press('Escape');
  expect(new URL(page.url()).searchParams.get('q')).toBe('"Build demo workflow 1"');
  await page.getByRole('button', { exact: true, name: 'Clear search' }).click();
  await expect(page.getByText('8 loaded tasks', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('textbox', { exact: true, name: 'Search tasks' })).toHaveValue(
    '"Build demo workflow 1"',
  );
  await page
    .getByRole('textbox', { exact: true, name: 'Search tasks' })
    .fill('no-such-search-word');
  await page.getByRole('button', { exact: true, name: 'Search' }).click();
  await expect(page.getByText('No matching tasks', { exact: true })).toBeVisible();
});
