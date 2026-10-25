import assert from 'node:assert/strict';
import test from 'node:test';

import { SearchPageSchema, SocketEvents } from '@flowboard/contracts';
import { chromium, expect } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

test(
  'open global search resets old cursor pages on workspace and resync events',
  { timeout: 120000 },
  async (t) => {
    const api = await startAppApi(t);
    const { origin } = await startWeb(t, api.origin, 'localhost', true, 'http://localhost:39999');
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { height: 1000, width: 1440 } });
    let socket;
    let connected = false;
    await page.routeWebSocket(/\/socket\.io\//, (connection) => {
      socket = connection;
      connection.onMessage((message) => {
        if (String(message).startsWith('40')) {
          connection.send('40{"sid":"search-test-client"}');
          connected = true;
        }
      });
      connection.send(
        '0{"sid":"search-test","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}',
      );
    });
    const requests = [];
    let generation = 0;
    await page.route('**/api/v1/search?*', (route) => {
      const query = new URL(route.request().url()).searchParams;
      requests.push(Object.fromEntries(query));
      const more = query.has('cursor');

      return route.fulfill({
        json: SearchPageSchema.parse({
          items: [
            {
              id: more ? api.privateList.id : api.publicList.id,
              type: 'list',
              title: more ? 'Old second page' : `Current result ${generation}`,
              containerId: api.publicList.parentId,
              path: ['Product', 'Roadmap'],
            },
          ],
          configVersion: generation + 1,
          dataVersion: generation + 1,
          pageInfo: { hasNextPage: !more, nextCursor: more ? null : `cursor-${generation}` },
        }),
      });
    });
    await page.goto(`${origin}/login`);
    await page.getByLabel(/^Email/).fill('alice@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.getByRole('button', { name: /Engineering/ }).click();
    await expect.poll(() => connected).toBe(true);
    await page.getByRole('button', { exact: true, name: 'Search tasks and lists' }).click();
    const dialog = page.getByRole('dialog', { name: 'Search workspace' });
    await dialog.getByLabel(/^Search tasks and lists/).fill('release');
    await dialog.getByRole('button', { exact: true, name: 'Search' }).click();
    await expect(dialog.getByRole('button', { name: 'Open list: Current result 0' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Load more results' }).click();
    await expect(dialog.getByRole('button', { name: 'Open list: Old second page' })).toBeVisible();
    assert.equal(requests.at(-1).cursor, 'cursor-0');

    for (const event of [
      { eventId: '10000000-0000-4000-8000-000000000999', kind: 'workspace' },
      { kind: 'resync' },
    ]) {
      generation += 1;
      socket.send(`42${JSON.stringify([SocketEvents.invalidate, event])}`);
      await expect(
        dialog.getByRole('button', { name: `Open list: Current result ${generation}` }),
      ).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Open list: Old second page' })).toHaveCount(
        0,
      );
      assert.equal(requests.at(-1).q, 'release');
      assert.equal(requests.at(-1).cursor, undefined, 'invalidation starts from the first page');
    }
  },
);
