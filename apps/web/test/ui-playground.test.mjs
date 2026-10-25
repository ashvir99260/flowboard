import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { designTokens } from '@flowboard/ui/tokens';
import { chromium } from '@playwright/test';

import { startUpstream, startWeb } from './common/proxy-fixture.mjs';
import { selectAutocomplete } from './common/selectAutocomplete.mjs';

function luminance(color, background = 'rgb(255, 255, 255)') {
  const backdrop = background
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number);
  const values = color.match(/[\d.]+/g).map(Number);
  const opacity = values[3] ?? 1;
  const channels = color
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number)
    .map((channel, index) => opacity * channel + (1 - opacity) * backdrop[index])
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
    assert.match(await response.text(), /2026-01-02 03:04:05 UTC/);
    await page.getByRole('heading', { name: 'Component playground' }).waitFor();
    const directory = new URL('../../../.ai-local/p2701/', import.meta.url);
    await mkdir(directory, { recursive: true });
    for (const mode of ['light', 'dark']) {
      const control = page.getByRole('button', {
        name: `${mode === 'light' ? 'Light' : 'Dark'} theme`,
      });
      // Establish keyboard modality before focusing a specific control.
      await page.keyboard.press('Tab');
      await control.focus();
      await page.keyboard.press('Enter');
      const expectedBackground = await page.evaluate((color) => {
        const sample = document.createElement('span');
        sample.style.color = color;
        document.body.append(sample);
        const result = getComputedStyle(sample).color;
        sample.remove();

        return result;
      }, designTokens.palette[mode].background);
      await page.waitForFunction(
        (expected) => getComputedStyle(document.body).backgroundColor === expected,
        expectedBackground,
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
      assert.ok(await page.getByText('Due · 2026-01-01 00:00:00 UTC', { exact: true }).isVisible());
      const composed = page.getByRole('region', { name: 'Composed workspace panel' });
      await composed.getByRole('button', { name: 'Open task: Review shared components' }).click();
      assert.ok(
        await composed.getByRole('status').filter({ hasText: 'Selected sample-task' }).isVisible(),
      );
      assert.ok(await composed.getByText('2026-01-02 03:04:05 UTC', { exact: true }).isVisible());
      assert.equal(await composed.locator('script').count(), 0);
      assert.equal(await composed.locator('a').getAttribute('href'), '');
      assert.ok(await page.getByText('Effort: 0', { exact: true }).isVisible());
      assert.ok(await page.getByText('Approved: No', { exact: true }).isVisible());
      const colors = await page.getByText('+2', { exact: true }).evaluate((element) => {
        const style = getComputedStyle(element);

        return [style.color, style.backgroundColor];
      });
      const levels = colors.map((color) => luminance(color)).sort((a, b) => b - a);
      assert.ok(
        (levels[0] + 0.05) / (levels[1] + 0.05) >= 4.5,
        `${mode} overflow avatar text must meet AA contrast`,
      );
      const form = page.getByRole('form', { name: 'Task field example' });
      const fieldMetrics = await form
        .locator('.MuiOutlinedInput-root, .MuiPickersOutlinedInput-root')
        .evaluateAll((roots) =>
          roots.map((root) => {
            const outline = root.querySelector('fieldset');
            const style = getComputedStyle(outline);

            return {
              background: getComputedStyle(root.closest('section')).backgroundColor,
              color: style.borderTopColor,
              height: root.getBoundingClientRect().height,
              borders: [
                style.borderTopStyle,
                style.borderRightStyle,
                style.borderBottomStyle,
                style.borderLeftStyle,
              ],
            };
          }),
        );
      assert.equal(fieldMetrics.length, 5);
      for (const field of fieldMetrics) {
        assert.equal(field.height, 36, `${mode} single-line fields are compact`);
        assert.deepEqual(field.borders, ['solid', 'solid', 'solid', 'solid']);
        const levels = [luminance(field.color, field.background), luminance(field.background)].sort(
          (a, b) => b - a,
        );
        assert.ok(
          (levels[0] + 0.05) / (levels[1] + 0.05) >= 3,
          `${mode} input boundary must meet 3:1 contrast`,
        );
      }
      const menu = page.getByRole('combobox', { name: 'Compact menu' });
      assert.equal(
        await menu.evaluate(
          (input) => input.closest('.MuiInputBase-root').getBoundingClientRect().height,
        ),
        36,
      );
      await selectAutocomplete(menu, 'Due date');
      assert.equal(await menu.inputValue(), 'Due date');
      const notes = page.getByRole('textbox', { name: 'Expanding notes' });
      await notes.fill('First line\nSecond line');
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      const initialHeight = await notes.evaluate((input) => input.getBoundingClientRect().height);
      await notes.fill('First\nSecond\nThird\nFourth\nFifth\nSixth');
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      assert.ok(
        await notes.evaluate(
          (input, height) =>
            input.getBoundingClientRect().height > height &&
            input.scrollHeight <= input.clientHeight + 1,
          initialHeight,
        ),
      );
      const badges = await page.locator('.MuiChip-root').evaluateAll((chips) =>
        chips.map((chip) => ({
          filled: chip.classList.contains('MuiChip-filled'),
          background: getComputedStyle(chip).backgroundColor,
          color: getComputedStyle(chip).color,
        })),
      );
      assert.ok(badges.length >= 10);
      for (const badge of badges) {
        assert.ok(badge.filled);
        assert.notEqual(badge.background, 'rgba(0, 0, 0, 0)');
        const levels = [luminance(badge.color), luminance(badge.background)].sort((a, b) => b - a);
        assert.ok(
          (levels[0] + 0.05) / (levels[1] + 0.05) >= 4.5,
          `${mode} filled badge text contrast`,
        );
      }
      for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)),
            ),
        );
        await page.screenshot({
          path: fileURLToPath(new URL(`${mode}-${width}.png`, directory)),
          fullPage: true,
        });
        if (width === 1440)
          await page
            .getByRole('heading', { exact: true, name: 'Status' })
            .locator('..')
            .screenshot({
              path: fileURLToPath(new URL(`${mode}-status.png`, directory)),
            });

        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          `${mode} at ${width}px must not overflow`,
        );
      }
    }
    assert.deepEqual(apiRequests, []);
    assert.deepEqual(errors, []);
    const touch = await browser.newContext({ hasTouch: true });
    t.after(() => touch.close());
    const touchPage = await touch.newPage();
    await touchPage.goto(`${origin}/playground`);
    const touchButton = touchPage.getByRole('button', { name: 'Preview JSON' });
    await touchButton.waitFor();
    assert.ok((await touchButton.boundingBox()).height >= 44);
    assert.ok(
      await touchPage
        .getByRole('form', { name: 'Task field example' })
        .locator('.MuiOutlinedInput-root, .MuiPickersOutlinedInput-root')
        .evaluateAll(
          (roots) =>
            roots.length === 5 && roots.every((root) => root.getBoundingClientRect().height >= 44),
        ),
    );
  },
);
