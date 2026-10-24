import assert from 'node:assert/strict';
import test from 'node:test';

import { chromium } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

test('clicking an empty stacked field label focuses its input', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const api = await startAppApi(t);
  const { origin } = await startWeb(t, api.origin);
  const page = await browser.newPage();
  await page.goto(`${origin}/login`);
  const input = page.getByLabel(/^Email/);
  await input.waitFor();
  const id = await input.getAttribute('id');
  const label = page.locator(`label[for="${id}"]`);
  await label.click({ force: true });
  assert.equal(await input.evaluate((element) => document.activeElement === element), true);
});
