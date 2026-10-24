import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { startUpstream, startWeb } from './common/proxy-fixture.mjs';

test('independent development servers render without competing for a build lock', async (t) => {
  const declaration = new URL('../next-env.d.ts', import.meta.url);
  const original = await readFile(declaration, 'utf8');
  const upstream = await startUpstream(t, (_request, response) => response.writeHead(500).end());
  const first = await startWeb(t, upstream, 'localhost', true);
  const second = await startWeb(t, upstream, 'localhost', true);
  for (const server of [first, second]) {
    const response = await fetch(`${server.origin}/playground`);
    assert.equal(response.status, 200, server.runtime.output());
    assert.match(await response.text(), /Component playground/);
  }
  assert.equal(await readFile(declaration, 'utf8'), original);
});
