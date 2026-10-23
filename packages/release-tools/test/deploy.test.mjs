import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deployReleasedApps } from '../dist/deploy.js';

const sha = 'a'.repeat(40);
const digest = `sha256:${'b'.repeat(64)}`;
const manifest = (app) => ({
  app,
  digest,
  image: `ghcr.io/owner/flowboard-${app}`,
  schemaVersion: 1,
  sha,
  tag: `${app}/v0.1.0`,
  version: '0.1.0',
});
const config = {
  apiServiceId: 'api',
  githubRepoId: '123',
  northflankProjectId: 'flowboard',
  northflankToken: 'fixture',
  vercelProjectId: 'prj_test',
  vercelToken: 'fixture',
  workerServiceId: 'worker',
};

test('API-only publication deploys the API digest without deploying web or worker', async () => {
  const calls = [];
  await deployReleasedApps({
    sha,
    manifests: [manifest('api')],
    config,
    assertReachable: async (source) => {
      if (source !== sha) throw new Error('Invalid source');
    },
    assertCurrent: async () => {},
    providers: {
      northflank: async (value, service) => {
        calls.push([service, value.image, value.digest]);
      },
      vercel: async () => {
        assert.fail('web must not deploy');
      },
    },
  });
  assert.deepEqual(calls, [['api', 'ghcr.io/owner/flowboard-api', digest]]);
});

test('no published apps means no provider configuration or calls are needed', async () => {
  await deployReleasedApps({
    sha,
    manifests: [],
    config: {},
    assertReachable: async (source) => {
      if (source !== sha) throw new Error('Invalid source');
    },
    assertCurrent: async () => {},
    providers: {
      vercel: async () => assert.fail('unexpected deployment'),
      northflank: async () => assert.fail('unexpected deployment'),
    },
  });
});

test('all required settings are checked before any provider is changed', async () => {
  const calls = [];
  await assert.rejects(
    deployReleasedApps({
      sha,
      manifests: [manifest('api'), manifest('web')],
      config: { apiServiceId: 'api', northflankProjectId: 'p', northflankToken: 'token' },
      assertReachable: async (source) => {
        if (source !== sha) throw new Error('Invalid source');
      },
      assertCurrent: async () => {},
      providers: {
        northflank: async () => {
          calls.push('api');
        },
        vercel: async () => {
          calls.push('web');
        },
      },
    }),
    /vercelToken/,
  );
  assert.deepEqual(calls, []);
});

test('stale main runs cannot begin deployment', async () => {
  await assert.rejects(
    deployReleasedApps({
      sha,
      manifests: [manifest('api')],
      config,
      assertReachable: async (source) => {
        if (source !== sha) throw new Error('Invalid source');
      },
      assertCurrent: async () => {
        throw new Error('stale main');
      },
      providers: {
        northflank: async () => assert.fail('must not deploy'),
        vercel: async () => assert.fail('must not deploy'),
      },
    }),
    /stale main/,
  );
});

test('foreign or duplicate release manifests are rejected before deployment', async () => {
  for (const manifests of [
    [{ ...manifest('web'), sha: 'c'.repeat(40) }],
    [manifest('api'), manifest('api')],
  ]) {
    await assert.rejects(
      deployReleasedApps({
        sha,
        manifests,
        config,
        assertReachable: async (source) => {
          if (source !== sha) throw new Error('Invalid source');
        },
        assertCurrent: async () => {},
        providers: {
          northflank: async () => assert.fail('must not deploy'),
          vercel: async () => assert.fail('must not deploy'),
        },
      }),
      /Invalid|Duplicate/,
    );
  }
});

test('a current main run can deploy a verified ancestor release missed by an earlier run', async () => {
  const calls = [];
  await deployReleasedApps({
    sha: 'd'.repeat(40),
    manifests: [manifest('api')],
    config,
    assertReachable: async (source) => {
      assert.equal(source, sha);
    },
    assertCurrent: async () => {},
    providers: {
      northflank: async (value) => {
        calls.push(value.sha);
      },
      vercel: async () => assert.fail('unexpected web deployment'),
    },
  });
  assert.deepEqual(calls, [sha]);
});
