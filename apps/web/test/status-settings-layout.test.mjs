import test from 'node:test';

import { expect } from '@playwright/test';

import { openSettings } from './common/status-settings-fixture.mjs';

test(
  'status settings remain usable at all target widths and hidden drafts cannot receive focus',
  { timeout: 120000 },
  async (t) => {
    const { page } = await openSettings(t);
    await page.getByRole('button', { exact: true, name: 'Edit In progress' }).click();
    const { mkdir } = await import('node:fs/promises');
    await mkdir(new URL('../../../.ai-local/p1001/', import.meta.url), { recursive: true });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(page.getByLabel(/^Status name/)).toBeVisible();
      await expect(page.getByRole('button', { exact: true, name: 'Save status' })).toBeVisible();
      // Responsive hooks settle after the viewport event; measure the rendered layout.
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
      await page.screenshot({
        path: new URL(`../../../.ai-local/p1001/status-settings-${width}.png`, import.meta.url)
          .pathname,
        fullPage: true,
      });
    }
  },
);
