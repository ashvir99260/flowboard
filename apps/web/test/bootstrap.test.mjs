import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import test from 'node:test';

import { startProcess } from '@flowboard/config-jest/process';

test(
  'production Next serves an honest setup page and stops cleanly',
  { timeout: 60_000 },
  async (t) => {
    const reserve = createServer();
    reserve.listen(0, '127.0.0.1');
    await once(reserve, 'listening');
    const { port } = reserve.address();
    await new Promise((resolve, reject) =>
      reserve.close((error) => (error ? reject(error) : resolve())),
    );
    const require = createRequire(import.meta.url);
    const runtime = startProcess(
      [
        require.resolve('next/dist/bin/next'),
        'start',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(port),
      ],
      { cwd: new URL('../', import.meta.url), env: { NEXT_TELEMETRY_DISABLED: '1' } },
    );
    // Next exits with 128 + SIGTERM's signal number after closing the server.
    t.after(() => runtime.stop(null, 143));
    await runtime.waitFor(/Ready in/);
    const response = await fetch(`http://127.0.0.1:${port}`, {
      signal: AbortSignal.timeout(5_000),
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<h1[^>]*>Flowboard<\/h1>/);
    assert.match(html, /Application foundation is ready/);
    assert.match(html, /Product features are not implemented yet/);
  },
);
