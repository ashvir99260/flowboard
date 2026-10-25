import assert from 'node:assert/strict';
import test from 'node:test';

import { getTask } from '@flowboard/api-client/sdk';
import { setupClient } from '@flowboard/api-client/session';
import { chromium } from '@playwright/test';

import { startUpstream, startWeb } from './common/proxy-fixture.mjs';

// This transport fixture emits contract-valid sessions; API authentication has real DB tests.
const session = (token) => ({
  data: {
    accessToken: token,
    expiresAt: '2027-01-01T00:00:00.000Z',
    user: {
      createdAt: '2026-10-24T00:00:00.000Z',
      email: 'alice@example.com',
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Alice',
      updatedAt: '2026-10-24T00:00:00.000Z',
    },
    activeWorkspace: {
      archivedAt: null,
      createdAt: '2026-10-24T00:00:00.000Z',
      id: '10000000-0000-4000-8000-000000000002',
      name: 'Workspace',
      role: 'admin',
      updatedAt: '2026-10-24T00:00:00.000Z',
    },
  },
});

test(
  'browser keeps refresh cookies on the web host across generated login, refresh and logout',
  { timeout: 90_000 },
  async (t) => {
    const first = 'a'.repeat(43);
    const rotated = 'b'.repeat(43);
    let refreshes = 0;
    let webOrigin;
    const taskTokens = [];
    const api = await startUpstream(t, (request, response) => {
      response.setHeader('Content-Type', 'application/json');
      if (request.method === 'POST') assert.equal(request.headers.origin, webOrigin);

      if (request.url === '/v1/auth/login') {
        response.setHeader(
          'Set-Cookie',
          `flowboard_refresh=${first}; Path=/; HttpOnly; SameSite=Lax`,
        );
        response.end(JSON.stringify(session('old-token')));

        return;
      }

      if (request.url === '/v1/auth/refresh') {
        assert.equal(request.headers.cookie, `flowboard_refresh=${first}`);
        refreshes++;
        response.setHeader(
          'Set-Cookie',
          `flowboard_refresh=${rotated}; Path=/; HttpOnly; SameSite=Lax`,
        );
        response.end(JSON.stringify(session('new-token')));

        return;
      }

      if (request.url === '/v1/auth/logout') {
        assert.equal(request.headers.cookie, `flowboard_refresh=${rotated}`);
        response.setHeader(
          'Set-Cookie',
          'flowboard_refresh=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
        );
        response.writeHead(204);
        response.end();

        return;
      }

      taskTokens.push(request.headers.authorization);
      response.writeHead(request.headers.authorization === 'Bearer new-token' ? 200 : 401);
      response.end(
        JSON.stringify(
          request.headers.authorization === 'Bearer new-token'
            ? { ok: true }
            : { error: { code: 'UNAUTHENTICATED', message: 'Expired token' } },
        ),
      );
    });
    const web = await startWeb(t, api, 'flowboard-web.test');
    webOrigin = web.origin;
    const browser = await chromium.launch({
      args: [
        '--no-proxy-server',
        '--host-resolver-rules=MAP flowboard-web.test [::1], MAP flowboard-api.test [::1]',
      ],
    });
    t.after(() => browser.close());
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(webOrigin);
    const requests = [];
    const runtime = setupClient({
      baseUrl: `${webOrigin}/api`,
      origin: webOrigin,
      fetch: async (request) => {
        requests.push(request.url);
        const headers = [...request.headers].filter(([name]) => name !== 'origin');
        const result = await page.evaluate(
          async (input) => {
            const response = await globalThis.fetch(input.url, {
              method: input.method,
              headers: input.headers,
              body: input.body,
              credentials: 'include',
            });

            return {
              status: response.status,
              body: await response.text(),
              headers: [...response.headers],
            };
          },
          {
            url: request.url,
            method: request.method,
            headers,
            body: request.body ? await request.text() : undefined,
          },
        );

        return new globalThis.Response(result.status === 204 ? null : result.body, {
          status: result.status,
          headers: result.headers,
        });
      },
    });
    t.after(() => runtime.dispose());
    await runtime.login({ email: 'alice@example.com', password: 'TransportFixture123!' });
    const [cookie] = await context.cookies(webOrigin);
    assert.equal(cookie.domain, 'flowboard-web.test');
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, 'Lax');
    assert.equal(cookie.path, '/');
    assert.equal(cookie.value, first);
    assert.equal(await page.evaluate(() => document.cookie), '');
    assert.deepEqual(await context.cookies(api), []);
    await getTask({ client: runtime.client, path: { taskId: 'one' }, throwOnError: true });
    assert.equal(refreshes, 1);
    assert.deepEqual(taskTokens, ['Bearer old-token', 'Bearer new-token']);
    assert.equal((await context.cookies(webOrigin))[0].value, rotated);
    await runtime.logout();
    assert.deepEqual(await context.cookies(webOrigin), []);
    assert.equal(runtime.getSession(), null);
    assert.ok(requests.every((url) => url.startsWith(`${webOrigin}/api/v1/`)));
  },
);
