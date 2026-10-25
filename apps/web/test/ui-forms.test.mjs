import assert from 'node:assert/strict';
import test from 'node:test';

import { chromium } from '@playwright/test';

import { startUpstream, startWeb } from './common/proxy-fixture.mjs';

test(
  'playground forms share domain validation and preserve stable option rows',
  { timeout: 120_000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startUpstream(t, (_request, response) => response.writeHead(500).end());
    const { origin } = await startWeb(t, api, 'localhost', true);
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    // A cold Next development route compiles on its first navigation.
    page.setDefaultNavigationTimeout(30000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${origin}/playground`);
    const jsonForm = page.getByRole('form', { name: 'JSON form example' });
    await jsonForm.getByRole('button', { name: 'Preview JSON' }).click();
    await jsonForm.getByText('Enter a label').waitFor();
    const jsonLabel = jsonForm.getByLabel('Label', { exact: false });
    assert.ok(await jsonLabel.evaluate((element) => element === document.activeElement));
    await jsonLabel.fill('Roadmap');
    await jsonForm.getByRole('button', { name: 'Preview JSON' }).click();
    await page.getByLabel('JSON result').getByText('Roadmap', { exact: true }).waitFor();
    const form = page.getByRole('form', { name: 'Task field example' });
    await form.waitFor({ timeout: 10_000 });
    const clear = form.getByRole('button', { name: 'Clear Notified' });
    await clear.focus();
    await page.keyboard.press('Enter');
    assert.ok(
      await form
        .getByRole('checkbox', { exact: true, name: 'Notified' })
        .evaluate((element) => element === document.activeElement),
    );
    const effort = form.getByLabel('Effort', { exact: false });
    await effort.fill('');
    await effort.pressSequentially('0.05');
    assert.equal(await effort.inputValue(), '0.05');
    await form.getByRole('button', { name: 'Preview fields' }).click();
    await page
      .getByLabel('Saved field values')
      .getByText('Effort: 0.05', { exact: true })
      .waitFor();
    assert.ok(
      await page
        .getByLabel('Saved field values')
        .getByText('Approved: No', { exact: true })
        .isVisible(),
    );
    await effort.fill('-');
    await form.getByRole('button', { name: 'Preview fields' }).click();
    assert.equal(await effort.getAttribute('aria-invalid'), 'true');
    assert.equal(await effort.inputValue(), '-');
    await effort.fill('0');
    const team = form.getByRole('combobox', { name: /^Team\b/ });
    await team.hover();
    await team.locator('..').getByRole('button', { exact: true, name: 'Clear' }).click();
    await form.getByRole('button', { name: 'Preview fields' }).click();
    assert.equal(
      await form.getByRole('combobox', { name: /^Team\b/ }).getAttribute('aria-invalid'),
      'true',
    );
    const options = page.getByRole('form', { name: 'Option editor example' });
    const first = options.getByLabel('Option label').nth(0);
    const node = await first.elementHandle();
    await first.fill('UX');
    await options.getByRole('button', { name: 'Move option 1 down' }).click();
    assert.equal(await options.getByLabel('Option label').nth(1).inputValue(), 'UX');
    assert.ok(await node.evaluate((element) => element.isConnected));
    await options.getByRole('button', { name: 'Remove option 1' }).click();
    await options.getByRole('button', { name: 'Preview options' }).click();
    await page.getByLabel('Saved options').getByText('UX', { exact: true }).waitFor();
    const move = page.getByRole('button', { name: 'Move example card' });
    await move.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Move this example card?' });
    await dialog.waitFor();
    await page.waitForFunction(() => document.activeElement?.textContent === 'Cancel');
    await page.keyboard.press('Shift+Tab');
    assert.ok(
      await dialog
        .getByRole('button', { exact: true, name: 'Move card' })
        .evaluate((element) => element === document.activeElement),
    );
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.ok(await move.evaluate((element) => element === document.activeElement));
    await page.getByRole('button', { name: 'Collapse Example space' }).click();
    assert.equal(
      await page.getByRole('button', { exact: true, name: 'Example list' }).isVisible(),
      false,
    );
    await page.getByRole('button', { name: 'Expand Example space' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { exact: true, name: 'Example list' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('status').getByText('Selected Example list').waitFor();
    assert.deepEqual(errors, []);
  },
);
