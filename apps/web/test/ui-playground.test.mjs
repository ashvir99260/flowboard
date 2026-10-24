import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { startUpstream, startWeb } from './common/proxy-fixture.mjs';

function luminance(color) {
  const channels = color
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number)
    .map((channel) => {
      const value = channel / 255;

      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

test(
  'development playground demonstrates every display in both themes without overflow',
  { timeout: 120_000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startUpstream(t, (_request, response) => response.writeHead(500).end());
    const { origin, runtime } = await startWeb(t, api, 'localhost', true);
    const page = await browser.newPage({
      reducedMotion: 'reduce',
      timezoneId: 'America/Los_Angeles',
    });
    const errors = [];
    const apiRequests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('favicon'))
        errors.push(message.text());
    });
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
    });
    const response = await page.goto(`${origin}/playground`, { timeout: 60_000 });
    assert.equal(response.status(), 200, runtime.output());
    await page.getByRole('heading', { name: 'Component playground' }).waitFor();
    const directory = new URL('../../../.ai-local/p0801/', import.meta.url);
    await mkdir(directory, { recursive: true });
    for (const mode of ['light', 'dark']) {
      const control = page.getByRole('button', {
        name: `${mode === 'light' ? 'Light' : 'Dark'} theme`,
      });
      await control.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        (expected) => getComputedStyle(document.body).backgroundColor === expected,
        mode === 'light' ? 'rgb(247, 248, 250)' : 'rgb(16, 21, 29)',
      );
      assert.equal(await control.getAttribute('aria-pressed'), 'true');
      assert.equal(
        await control.evaluate((element) => getComputedStyle(element).outlineStyle),
        'solid',
      );
      assert.ok(
        await control.evaluate((element) =>
          getComputedStyle(element)
            .transitionDuration.split(',')
            .every((value) => Number.parseFloat(value) <= 0.001),
        ),
        'Reduced motion must suppress button transitions',
      );
      assert.ok(await page.getByText('Due · Jan 1, 2026', { exact: true }).isVisible());
      assert.ok(await page.getByText('Effort: 0', { exact: true }).isVisible());
      assert.ok(await page.getByText('Approved: No', { exact: true }).isVisible());
      const colors = await page.getByText('+2', { exact: true }).evaluate((element) => {
        const style = getComputedStyle(element);

        return [style.color, style.backgroundColor];
      });
      const levels = colors.map(luminance).sort((a, b) => b - a);
      assert.ok(
        (levels[0] + 0.05) / (levels[1] + 0.05) >= 4.5,
        `${mode} overflow avatar text must meet AA contrast`,
      );
      for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.screenshot({
          path: fileURLToPath(new URL(`${mode}-${width}.png`, directory)),
          fullPage: true,
        });
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          `${mode} at ${width}px must not overflow`,
        );
      }
    }
    assert.deepEqual(apiRequests, []);
    assert.deepEqual(errors, []);
  },
);
