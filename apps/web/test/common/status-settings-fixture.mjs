import { chromium } from '@playwright/test';

import { startRealApp } from './real-app-fixture.mjs';

export async function openSettings(t, kind = 'Status') {
  const app = await startRealApp(t);
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(`${app.origin}/login`);
  await page.getByLabel(/^Email/).fill('alice@example.com');
  await page.getByLabel(/^Password/).fill('FlowboardDemo123!');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Flowboard Demo/ }).click();
  await page.getByRole('link', { exact: true, name: `${kind} settings` }).click();
  await page.waitForURL((url) =>
    url.pathname.endsWith(`/settings/${kind === 'Status' ? 'statuses' : 'fields'}`),
  );

  return { page, browser, app };
}
