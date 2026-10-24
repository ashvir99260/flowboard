import test from 'node:test';

import { expect } from '@playwright/test';

import { openSettings } from './common/status-settings-fixture.mjs';

test(
  'members cannot open field configuration and field forms fit all target widths',
  { timeout: 120000 },
  async (t) => {
    const { page, browser, app } = await openSettings(t, 'Field');
    const url = page.url();
    await page.getByRole('button', { exact: true, name: 'Edit Effort' }).click();
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
      await expect(page.getByLabel(/^Field name/)).toBeVisible();
      await expect(page.getByRole('button', { exact: true, name: 'Save field' })).toBeVisible();
      const { mkdir } = await import('node:fs/promises');
      await mkdir(new URL('../../../.ai-local/p1002/', import.meta.url), { recursive: true });
      await page.screenshot({
        path: new URL(`../../../.ai-local/p1002/fields-${width}.png`, import.meta.url).pathname,
        fullPage: true,
      });
    }
    const context = await browser.newContext();
    try {
      const bob = await context.newPage();
      await bob.goto(`${app.origin}/login`);
      await bob.getByLabel(/^Email/).fill('bob@example.com');
      await bob.getByLabel(/^Password/).fill('FlowboardDemo123!');
      await bob.getByRole('button', { exact: true, name: 'Sign in' }).click();
      await bob.getByRole('button', { name: /Flowboard Demo/ }).click();
      await expect(bob.getByRole('link', { exact: true, name: 'Field settings' })).toHaveCount(0);
      await bob.goto(url);
      await expect(bob.getByRole('alert', { exact: true, name: 'Access denied' })).toBeVisible();
      await expect(bob.getByRole('button', { exact: true, name: 'Save field' })).toHaveCount(0);
    } finally {
      await context.close();
    }
  },
);
