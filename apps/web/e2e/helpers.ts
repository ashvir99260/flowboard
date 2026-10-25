import { expect } from '@playwright/test';

import type { Locator, Page } from '@playwright/test';

export async function selectAutocomplete(input: Locator, label: string) {
  await input.click();
  await input.fill(label);
  await input.page().getByRole('option', { name: label, exact: true }).click();
}

export async function login(page: Page, email = 'alice@example.com', visit = true) {
  if (visit) await page.goto('/login');

  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill('FlowboardDemo123!');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Flowboard Demo/ }).click();
  await expect(page.getByRole('button', { exact: true, name: 'Product backlog' })).toBeVisible();
}

export async function openBacklog(page: Page) {
  await page.getByRole('button', { exact: true, name: 'Product backlog' }).click();
  await expect(
    page.getByRole('button', { exact: true, name: 'Open task: Build demo workflow 1' }),
  ).toBeVisible();
}

export const column = (page: Page, name: string) =>
  page.getByRole('region', { exact: true, name: `${name} column` });
