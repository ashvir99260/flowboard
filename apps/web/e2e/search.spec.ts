import { expect, test } from '@playwright/test';

import { login, openBacklog } from './helpers';

test('search composes with sorting and filters and survives reload and navigation', async ({
  page,
}) => {
  await login(page);
  await openBacklog(page);
  await page.getByRole('link', { exact: true, name: 'List' }).click();
  await page.getByLabel(/^Search tasks/).fill('"Build demo workflow 1"');
  await page.getByRole('button', { exact: true, name: 'Search' }).click();
  await expect(page.getByText('1 loaded tasks', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('gridcell', { exact: true, name: 'Build demo workflow 1' }),
  ).toBeVisible();
  await page.getByLabel(/^Sort by/).selectOption('priority');
  expect(new URL(page.url()).searchParams.get('q')).toBe('"Build demo workflow 1"');
  await page.getByLabel(/^Filter field/).selectOption('effort');
  await page.getByLabel(/^Effort/).fill('1');
  await page.getByRole('button', { exact: true, name: 'Apply filter' }).click();
  await page.reload();
  await expect(page.getByLabel(/^Search tasks/)).toHaveValue('"Build demo workflow 1"');
  await expect(page.getByText('1 loaded tasks', { exact: true })).toBeVisible();
  await page.getByRole('button', { exact: true, name: 'Clear filter' }).click();
  expect(new URL(page.url()).searchParams.get('q')).toBe('"Build demo workflow 1"');
  await page.getByRole('button', { exact: true, name: 'Clear search' }).click();
  await expect(page.getByText('8 loaded tasks', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel(/^Search tasks/)).toHaveValue('"Build demo workflow 1"');
  await page.getByLabel(/^Search tasks/).fill('no-such-search-word');
  await page.getByRole('button', { exact: true, name: 'Search' }).click();
  await expect(page.getByText('No matching tasks', { exact: true })).toBeVisible();
});
