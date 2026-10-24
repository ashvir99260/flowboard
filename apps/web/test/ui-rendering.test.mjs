import assert from 'node:assert/strict';
import test from 'node:test';

import { chromium } from '@playwright/test';

import { startUpstream, startWeb } from './common/proxy-fixture.mjs';

test(
  'the built app sends theme styles in the head and hydrates without errors',
  { timeout: 60_000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startUpstream(t, (_request, response) => response.writeHead(500).end());
    const { origin } = await startWeb(t, api);
    const html = await (await fetch(origin)).text();
    const head = html.slice(0, html.indexOf('</head>'));
    assert.match(head, /data-emotion=/);
    assert.ok(head.includes('--mui-palette-background-default'));
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(origin);
    await page.getByRole('heading', { exact: true, name: 'Flowboard' }).waitFor();
    assert.equal(
      await page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor),
      'rgb(247, 248, 250)',
    );
    assert.deepEqual(errors, []);
    assert.equal((await page.goto(`${origin}/playground`)).status(), 404);
  },
);
