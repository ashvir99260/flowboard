import assert from 'node:assert/strict';
import test from 'node:test';

import { AuthExamples } from '@flowboard/contracts';
import { chromium } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

test(
  'the built app sends theme styles in the head and hydrates without errors',
  { timeout: 60_000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startAppApi(t);
    api.cookies.set('theme-fixture-cookie', AuthExamples.session);
    const { origin } = await startWeb(t, api.origin);
    const html = await (await fetch(origin)).text();
    const head = html.slice(0, html.indexOf('</head>'));
    assert.match(head, /data-emotion=/);
    assert.ok(head.includes('--mui-palette-background-default'));
    const page = await browser.newPage();
    await page.context().addCookies([
      {
        name: 'flowboard_refresh',
        value: 'theme-fixture-cookie',
        url: origin,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(origin);
    await page.getByRole('heading', { exact: true, name: 'Choose a workspace' }).waitFor();
    assert.equal(
      await page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor),
      'rgb(250, 250, 250)',
    );
    assert.deepEqual(errors, []);
    assert.equal((await page.goto(`${origin}/playground`)).status(), 404);
  },
);
