import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import test from 'node:test';

import { startProcess } from '@flowboard/config-jest/process';

test(
  'production Next serves an honest setup page and stops cleanly',
  { timeout: 60_000 },
  async (t) => {
    const reserve = createServer();
    reserve.listen(0, 'localhost');
    await once(reserve, 'listening');
    const { port } = reserve.address();
    await new Promise((resolve, reject) =>
      reserve.close((error) => (error ? reject(error) : resolve())),
    );
    const runtime = startProcess(['.next/standalone/apps/web/server.js'], {
      cwd: new URL('../', import.meta.url),
      env: { NEXT_TELEMETRY_DISABLED: '1', HOSTNAME: 'localhost', PORT: String(port) },
    });
    // Next exits with 128 + SIGTERM's signal number after closing the server.
    t.after(() => runtime.stop(null, 143));
    await runtime.waitFor(/Ready in/);
    const response = await fetch(`http://localhost:${port}`, {
      signal: AbortSignal.timeout(5_000),
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<h1[^>]*>Flowboard<\/h1>/);
    assert.match(html, /Application foundation is ready/);
    assert.match(html, /Product features are not implemented yet/);
    const asset = html.match(/src="([^"]*\/_next\/static\/[^"]+)"/);
    assert.ok(asset, 'The page references its compiled JavaScript');
    const assetResponse = await fetch(`http://localhost:${port}${asset[1]}`, {
      signal: AbortSignal.timeout(5_000),
    });
    assert.equal(assetResponse.status, 200, 'Standalone output includes browser assets');
  },
);
