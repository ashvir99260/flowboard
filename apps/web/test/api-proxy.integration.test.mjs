import assert from 'node:assert/strict';
import test from 'node:test';

import { startUpstream, startWeb } from './common/proxy-fixture.mjs';

test(
  'the same built Next app forwards to the runtime-configured API and never caches responses',
  { timeout: 60_000 },
  async (t) => {
    for (const label of ['first', 'second']) {
      let calls = 0;
      const api = await startUpstream(t, (request, response) => {
        calls++;
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Set-Cookie', [
          'flowboard_refresh=first; Path=/; HttpOnly; Expires=Fri, 25 Dec 2026 00:00:00 GMT',
          'flowboard_refresh=second; Path=/; HttpOnly',
        ]);
        response.end(JSON.stringify({ label, calls, path: request.url }));
      });
      const web = await startWeb(t, api);
      for (const count of [1, 2]) {
        const result = await fetch(`${web.origin}/api/v1/tasks?limit=2&limit=3`);
        assert.equal(result.status, 200);
        assert.equal(result.headers.get('cache-control'), 'no-store');
        assert.equal(result.headers.getSetCookie().length, 2);
        assert.deepEqual(await result.json(), {
          label,
          calls: count,
          path: '/v1/tasks?limit=2&limit=3',
        });
      }
      const html = await (await fetch(web.origin)).text();
      for (const asset of html.matchAll(/src="([^"]*\/_next\/static\/[^"]+)"/g)) {
        const source = await (await fetch(new URL(asset[1], web.origin))).text();
        assert.equal(source.includes(api), false);
        assert.equal(source.includes('API_INTERNAL_URL'), false);
      }
    }
  },
);
