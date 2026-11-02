import assert from 'node:assert/strict';
import test from 'node:test';

import { SocketEvents } from '@flowboard/contracts';
import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

for (const view of ['board', 'list'])
  test(`${view} retains content for subscription catch-up but clears it for global resync`, async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startAppApi(t);
    const { origin } = await startWeb(t, api.origin, 'localhost', false, 'http://localhost:39999');
    const page = await browser.newPage();
    let socket;
    const acknowledgements = new Map();
    await page.routeWebSocket(/\/socket\.io\//, (connection) => {
      socket = connection;
      connection.onMessage((message) => {
        const packet = String(message);
        if (packet.startsWith('40')) connection.send('40{"sid":"subscription-test-client"}');

        const ack = /^42(\d+)(\[.*)$/s.exec(packet);
        if (!ack) return;

        const [event, payload] = JSON.parse(ack[2]);
        if (event === SocketEvents.subscribe) acknowledgements.set(payload.listId, ack[1]);
      });
      connection.send(
        '0{"sid":"subscription-test","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}',
      );
    });
    await page.goto(`${origin}/login`);
    await page.getByLabel(/^Email/).fill('alice@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.getByRole('button', { name: /Engineering/ }).click();
    await page.getByRole('button', { exact: true, name: 'Public list' }).click();
    if (view === 'list') await page.getByRole('link', { name: 'List view' }).click();

    const content =
      view === 'board'
        ? page.getByRole('region', { exact: true, name: 'Task board' })
        : page.getByRole('grid', { name: 'List tasks' });
    await expect(
      content.getByRole('button', { name: 'Open task: Review navigation' }),
    ).toBeVisible();
    await expect.poll(() => acknowledgements.has(api.publicList.id)).toBe(true);
    const mounted = await content.elementHandle();
    let release;
    let reads = 0;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route('**/api/v1/lists/**', async (route) => {
      reads++;
      await gate;
      await route.continue();
    });
    try {
      socket.send(`43${acknowledgements.get(api.publicList.id)}[{"ok":true}]`);
      await expect.poll(() => reads).toBeGreaterThan(0);
      await expect(content).toBeVisible();
      await expect(
        content.getByRole('button', { name: 'Open task: Review navigation' }),
      ).toBeVisible();
      assert.equal(await mounted.evaluate((element) => element.isConnected), true);
      socket.send(`42${JSON.stringify([SocketEvents.invalidate, { kind: 'resync' }])}`);
      await expect(
        content.getByRole('button', { name: 'Open task: Review navigation' }),
      ).toHaveCount(0);
    } finally {
      release();
    }
  });
