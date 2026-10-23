import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createDeploymentProviders } from '../dist/deployment-providers.js';

const sha = 'a'.repeat(40);
const web = {
  schemaVersion: 1,
  app: 'web',
  version: '0.1.0',
  tag: 'web/v0.1.0',
  sha,
  image: 'ghcr.io/owner/flowboard-web',
  digest: `sha256:${'b'.repeat(64)}`,
};
const meta = { flowboardSha: sha, flowboardTag: web.tag };
const ready = {
  id: 'dpl_preview',
  target: null,
  readyState: 'READY',
  url: 'flowboard-preview.vercel.app',
  meta,
};
const config = { vercelToken: 'fixture', vercelProjectId: 'prj_test', githubRepoId: '123' };
const json = (data) => new globalThis.Response(JSON.stringify(data));

test('Vercel creates a preview from the released SHA and returns its ready URL without promoting', async () => {
  const calls = [];
  let polls = 0;
  const providers = createDeploymentProviders(config, {
    assertCurrent: async () => {},
    sleep: async () => {},
    fetch: async (url, init) => {
      const parsed = new URL(url);
      calls.push(`${init.method} ${parsed.pathname}`);
      if (parsed.pathname === '/v9/projects/prj_test') return json({ name: 'flowboard-web' });
      if (parsed.pathname === '/v7/deployments') {
        if (!parsed.searchParams.has('target'))
          return json({ deployments: [{ uid: 'dpl_bootstrap' }] });
        assert.equal(parsed.searchParams.get('target'), 'preview');
        assert.equal(parsed.searchParams.get('sha'), sha);
        return json({ deployments: [] });
      }
      if (parsed.pathname === '/v13/deployments') {
        const body = JSON.parse(init.body);
        assert.equal(body.target, undefined);
        assert.equal(body.autoAssignCustomDomains, false);
        assert.deepEqual(body.gitSource, { type: 'github', repoId: '123', ref: sha, sha });
        assert.deepEqual(body.meta, meta);
        return json({ id: ready.id });
      }
      if (parsed.pathname === '/v13/deployments/dpl_preview')
        return json({ ...ready, readyState: ++polls === 1 ? 'BUILDING' : 'READY' });
      assert.fail(`Unexpected provider request ${parsed.pathname}`);
    },
  });
  assert.equal(await providers.vercel(web), 'https://flowboard-preview.vercel.app');
  assert.equal(calls.filter((call) => call.startsWith('POST')).length, 1);
  assert.equal(polls, 2);
});

test('an empty Vercel project fails before its first deployment can become production', async () => {
  const providers = createDeploymentProviders(config, {
    assertCurrent: async () => {},
    fetch: async (url, init) => {
      assert.equal(init.method, 'GET');
      if (new URL(url).pathname === '/v9/projects/prj_test')
        return json({ name: 'flowboard-preview' });
      return json({ deployments: [] });
    },
  });
  await assert.rejects(providers.vercel(web), /initial deployment.*production/);
});

for (const target of [null, undefined, 'preview'])
  test(`Vercel retries reuse a preview with target ${String(target)}, excluding production`, async () => {
    const providers = createDeploymentProviders(config, {
      assertCurrent: async () => {},
      fetch: async (url, init) => {
        assert.equal(init.method, 'GET');
        const parsed = new URL(url);
        if (parsed.pathname === '/v9/projects/prj_test') return json({ name: 'flowboard-web' });
        if (parsed.pathname === '/v7/deployments') {
          if (!parsed.searchParams.has('until'))
            return json({
              deployments: [{ uid: 'dpl_production', target: 'production', meta }],
              pagination: { next: 50 },
            });
          assert.equal(parsed.searchParams.get('until'), '50');
          return json({ deployments: [{ uid: ready.id, target, state: 'BUILDING', meta }] });
        }
        if (parsed.pathname === '/v13/deployments/dpl_preview') return json({ ...ready, target });
        assert.fail(`Unexpected provider request ${parsed.pathname}`);
      },
    });
    assert.equal(await providers.vercel(web), 'https://flowboard-preview.vercel.app');
  });

for (const state of ['ERROR', 'CANCELED', 'BLOCKED', 'BUILDING'])
  test(`Vercel preview ${state} is not reported ready`, async () => {
    let time = 0;
    const providers = createDeploymentProviders(config, {
      assertCurrent: async () => {},
      now: () => time,
      timeoutMs: 10,
      sleep: async () => {
        time += 10;
      },
      fetch: async (url, init) => {
        assert.equal(init.method, 'GET');
        const path = new URL(url).pathname;
        if (path === '/v9/projects/prj_test') return json({ name: 'flowboard-web' });
        if (path === '/v7/deployments')
          return json({ deployments: [{ uid: ready.id, target: null, state: 'BUILDING', meta }] });
        if (path === '/v13/deployments/dpl_preview') return json({ ...ready, readyState: state });
        assert.fail(`Unexpected provider request ${path}`);
      },
    });
    await assert.rejects(providers.vercel(web), state === 'BUILDING' ? /timed out/ : /failed/);
  });

for (const value of [
  { target: 'production' },
  { meta: { ...meta, flowboardSha: 'c'.repeat(40) } },
  { url: '' },
  { url: 'https://attacker.example' },
  { url: 'https://user:password@flowboard.vercel.app' },
])
  test(`Vercel ready response rejects an invalid preview identity or URL: ${JSON.stringify(value)}`, async () => {
    const providers = createDeploymentProviders(config, {
      assertCurrent: async () => {},
      fetch: async (url, init) => {
        assert.equal(init.method, 'GET');
        const path = new URL(url).pathname;
        if (path === '/v9/projects/prj_test') return json({ name: 'flowboard-web' });
        if (path === '/v7/deployments')
          return json({ deployments: [{ uid: ready.id, target: null, meta }] });
        if (path === '/v13/deployments/dpl_preview') return json({ ...ready, ...value });
        assert.fail(`Unexpected provider request ${path}`);
      },
    });
    await assert.rejects(providers.vercel(web), /Invalid Vercel preview/);
  });

test('a stale workflow cannot create a Vercel preview', async () => {
  const providers = createDeploymentProviders(config, {
    assertCurrent: async () => {
      throw new Error('stale main');
    },
    fetch: async (url, init) => {
      assert.equal(init.method, 'GET');
      if (new URL(url).pathname === '/v9/projects/prj_test') return json({ name: 'flowboard-web' });
      const parsed = new URL(url);
      return json({
        deployments: parsed.searchParams.has('target') ? [] : [{ uid: 'dpl_bootstrap' }],
      });
    },
  });
  await assert.rejects(providers.vercel(web), /stale main/);
});
