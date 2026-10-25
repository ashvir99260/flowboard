import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deployReleasedApps } from '../dist/deploy.js';

const sha = 'a'.repeat(40);
const manifest = (app) => ({
  app,
  digest: `sha256:${'b'.repeat(64)}`,
  image: `ghcr.io/owner/flowboard-${app}`,
  schemaVersion: 1,
  sha,
  tag: `${app}/v0.1.0`,
  version: '0.1.0',
});
const config = {
  githubRepoId: '123',
  vercelProjectId: 'prj_test',
  vercelTeamId: 'team_test',
  vercelToken: 'fixture',
};
const reachable = async (source) => assert.equal(source, sha);

test('an API-only release deploys the complete Vercel project once without Northflank settings', async () => {
  const calls = [];
  await deployReleasedApps({
    sha,
    manifests: [manifest('api')],
    config,
    assertReachable: reachable,
    assertCurrent: async () => {},
    providers: { vercel: async (value) => calls.push(value) },
  });
  assert.deepEqual(calls, [{ sha, tags: ['api/v0.1.0'] }]);
});

test('several independently published applications share one deployment and canonical retry identity', async () => {
  const calls = [];
  await deployReleasedApps({
    sha,
    manifests: ['worker', 'web', 'api'].map(manifest),
    config,
    assertReachable: reachable,
    assertCurrent: async () => {},
    providers: { vercel: async (value) => calls.push(value) },
  });
  assert.deepEqual(calls, [{ sha, tags: ['api/v0.1.0', 'web/v0.1.0', 'worker/v0.1.0'] }]);
});

test('no published apps means no provider configuration or calls are needed', async () => {
  await deployReleasedApps({
    sha,
    manifests: [],
    config: {},
    assertReachable: reachable,
    assertCurrent: async () => {},
    providers: { vercel: async () => assert.fail('unexpected deployment') },
  });
});

for (const key of Object.keys(config))
  test(`missing ${key} is rejected before any provider is changed`, async () => {
    await assert.rejects(
      deployReleasedApps({
        sha,
        manifests: [manifest('api'), manifest('web')],
        config: { ...config, [key]: '' },
        assertReachable: reachable,
        assertCurrent: async () => {},
        providers: { vercel: async () => assert.fail('must not deploy') },
      }),
      new RegExp(key),
    );
  });

test('stale main runs cannot begin deployment', async () => {
  await assert.rejects(
    deployReleasedApps({
      sha,
      manifests: [manifest('api')],
      config,
      assertReachable: reachable,
      assertCurrent: async () => {
        throw new Error('stale main');
      },
      providers: { vercel: async () => assert.fail('must not deploy') },
    }),
    /stale main/,
  );
});

test('foreign or duplicate release manifests are rejected before deployment', async () => {
  for (const manifests of [
    [{ ...manifest('web'), sha: 'c'.repeat(40) }],
    [manifest('api'), manifest('api')],
  ])
    await assert.rejects(
      deployReleasedApps({
        sha,
        manifests,
        config,
        assertReachable: reachable,
        assertCurrent: async () => {},
        providers: { vercel: async () => assert.fail('must not deploy') },
      }),
      /Invalid|Duplicate|equal/,
    );
});

test('current source, including deployment config changes, is deployed with verified ancestor releases', async () => {
  const current = 'd'.repeat(40);
  const calls = [];
  await deployReleasedApps({
    sha: current,
    manifests: [manifest('api')],
    config,
    assertReachable: reachable,
    assertCurrent: async () => {},
    providers: { vercel: async (value) => calls.push(value) },
  });
  assert.deepEqual(calls, [{ sha: current, tags: ['api/v0.1.0'] }]);
});
