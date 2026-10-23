import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createDeploymentProviders } from '../dist/deployment-providers.js';

const sha = 'a'.repeat(40);
const manifest = {
  schemaVersion: 1,
  app: 'api',
  version: '0.1.0',
  tag: 'api/v0.1.0',
  sha,
  image: 'ghcr.io/owner/flowboard-api',
  digest: `sha256:${'b'.repeat(64)}`,
};
const image = `${manifest.image}@${manifest.digest}`;
const config = { northflankToken: 'secret-token', northflankProjectId: 'flowboard' };
const json = (data, status = 200) =>
  new globalThis.Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

test('Northflank updates only the external image and waits for that digest to complete', async () => {
  let phase = 0;
  const writes = [];
  const providers = createDeploymentProviders(config, {
    assertCurrent: async () => {},
    sleep: async () => {},
    fetch: async (url, init) => {
      assert.ok(String(url).startsWith('https://api.northflank.com/v1/projects/flowboard/'));
      assert.equal(init.headers.Authorization, 'Bearer secret-token');
      if (init.method === 'PATCH') {
        writes.push(JSON.parse(init.body));
        phase = 1;
        return json({ data: {} });
      }
      const data = {
        deployment: {
          instances: 1,
          external: { imagePath: phase ? image : 'old', credentials: 'registry-credentials' },
          imageUrl: phase === 2 ? image : 'old',
        },
        status: {
          deployment: {
            status: phase === 1 ? 'IN_PROGRESS' : 'COMPLETED',
            lastTransitionTime: phase,
          },
        },
      };
      if (phase === 1) phase = 2;
      return json({ data });
    },
  });
  await providers.northflank(manifest, 'api');
  assert.deepEqual(writes, [
    {
      deployment: {
        external: { imagePath: image, credentials: 'registry-credentials' },
      },
    },
  ]);
});

test('Northflank retry reuses a completed matching digest without another update', async () => {
  const providers = createDeploymentProviders(config, {
    assertCurrent: async () => {},
    fetch: async (_url, init) => {
      assert.equal(init.method, 'GET');
      return json({
        data: {
          deployment: { instances: 1, external: { imagePath: image }, imageUrl: image },
          status: { deployment: { status: 'COMPLETED' } },
        },
      });
    },
  });
  await providers.northflank(manifest, 'api');
});

for (const scenario of ['failed', 'old-image', 'unauthorized'])
  test(`Northflank ${scenario} is never reported ready`, async () => {
    let time = 0;
    const providers = createDeploymentProviders(config, {
      assertCurrent: async () => {},
      now: () => time,
      timeoutMs: 10,
      sleep: async () => {
        time += 10;
      },
      fetch: async () =>
        scenario === 'unauthorized'
          ? json({}, 401)
          : json({
              data: {
                deployment: { instances: 1, external: { imagePath: image }, imageUrl: 'old' },
                status: { deployment: { status: scenario === 'failed' ? 'FAILED' : 'COMPLETED' } },
              },
            }),
    });
    await assert.rejects(
      providers.northflank(manifest, 'api'),
      scenario === 'failed' ? /failed/ : scenario === 'unauthorized' ? /401/ : /timed out/,
    );
  });
