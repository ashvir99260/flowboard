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

test('Vercel stages the exact released commit and promotes only after ready', async () => {
  const calls = [];
  let created = false;
  let promoted = false;
  const providers = createDeploymentProviders(
    { vercelToken: 'token', vercelProjectId: 'prj_test', githubRepoId: '123' },
    {
      assertCurrent: async () => {
        calls.push('current');
      },
      sleep: async () => {},
      fetch: async (url, init) => {
        const path = new URL(url).pathname;
        calls.push(`${init.method} ${path}`);
        if (path === '/v9/projects/prj_test')
          return json({
            name: 'flowboard-web',
            targets: { production: { id: promoted ? 'dpl_new' : 'dpl_old' } },
            lastAliasRequest: {
              toDeploymentId: promoted ? 'dpl_new' : 'dpl_old',
              jobStatus: 'succeeded',
            },
          });
        if (path === '/v7/deployments')
          return json({ deployments: [], pagination: { next: null } });
        if (path === '/v13/deployments') {
          const body = JSON.parse(init.body);
          assert.deepEqual(body.gitSource, { type: 'github', repoId: '123', ref: sha, sha });
          assert.equal(body.autoAssignCustomDomains, false);
          assert.equal(body.target, 'production');
          created = true;
          return json({ id: 'dpl_new' });
        }
        if (path === '/v13/deployments/dpl_new') {
          assert.ok(created);
          return json({ id: 'dpl_new', readyState: 'READY' });
        }
        if (path === '/v10/projects/prj_test/promote/dpl_new') {
          promoted = true;
          return json({});
        }
        assert.fail(`Unexpected ${path}`);
      },
    },
  );
  await providers.vercel({
    ...manifest,
    app: 'web',
    tag: 'web/v0.1.0',
    image: 'ghcr.io/owner/flowboard-web',
  });
  assert.ok(
    calls.indexOf('GET /v13/deployments/dpl_new') <
      calls.indexOf('POST /v10/projects/prj_test/promote/dpl_new'),
  );
  assert.equal(calls[calls.indexOf('POST /v10/projects/prj_test/promote/dpl_new') - 1], 'current');
});

for (const state of ['READY', 'ERROR', 'CANCELED', 'BLOCKED'])
  test(`Vercel retry at ${state} reuses identity and never silently promotes a failed build`, async () => {
    const methods = [];
    const web = {
      ...manifest,
      app: 'web',
      tag: 'web/v0.1.0',
      image: 'ghcr.io/owner/flowboard-web',
    };
    const providers = createDeploymentProviders(
      { vercelToken: 'token', vercelProjectId: 'prj_test', githubRepoId: '123' },
      {
        assertCurrent: async () => {},
        fetch: async (url, init) => {
          methods.push(init.method);
          const path = new URL(url).pathname;
          if (path === '/v9/projects/prj_test')
            return json({
              name: 'flowboard-web',
              targets: { production: { id: 'dpl_existing' } },
              lastAliasRequest: { toDeploymentId: 'dpl_existing', jobStatus: 'succeeded' },
            });
          if (path === '/v7/deployments')
            return json({
              deployments: [
                {
                  uid: 'dpl_existing',
                  target: 'production',
                  state: 'BUILDING',
                  meta: { flowboardSha: sha, flowboardTag: web.tag },
                },
              ],
              pagination: { next: null },
            });
          if (path === '/v13/deployments/dpl_existing') return json({ readyState: state });
          assert.fail(`Unexpected ${path}`);
        },
      },
    );
    if (state === 'READY') await providers.vercel(web);
    else await assert.rejects(providers.vercel(web), /failed/);
    assert.ok(methods.every((method) => method === 'GET'));
  });

test('Vercel ready build is not promoted if main changes during readiness polling', async () => {
  let reads = 0;
  const providers = createDeploymentProviders(
    { vercelToken: 'token', vercelProjectId: 'prj_test', githubRepoId: '123' },
    {
      assertCurrent: async () => {
        if (++reads > 1) throw new Error('stale main');
      },
      fetch: async (url, init) => {
        const path = new URL(url).pathname;
        if (path === '/v9/projects/prj_test') return json({ name: 'flowboard-web' });
        if (path === '/v7/deployments')
          return json({ deployments: [], pagination: { next: null } });
        if (path === '/v13/deployments') {
          assert.equal(JSON.parse(init.body).autoAssignCustomDomains, false);
          return json({ id: 'dpl_staged' });
        }
        assert.fail('stale build must not be promoted');
      },
    },
  );
  await assert.rejects(
    providers.vercel({ ...manifest, app: 'web', tag: 'web/v0.1.0' }),
    /stale main/,
  );
});

for (const outcome of ['failed', 'pending'])
  test(`Vercel ${outcome} promotion is not reported as success`, async () => {
    let time = 0;
    let promoted = false;
    const providers = createDeploymentProviders(
      { vercelToken: 'token', vercelProjectId: 'prj_test', githubRepoId: '123' },
      {
        assertCurrent: async () => {},
        now: () => time,
        timeoutMs: 10,
        sleep: async () => {
          time += 10;
        },
        fetch: async (url) => {
          const path = new URL(url).pathname;
          if (path === '/v9/projects/prj_test')
            return json({
              name: 'flowboard-web',
              targets: { production: { id: 'dpl_old' } },
              lastAliasRequest: {
                toDeploymentId: promoted ? 'dpl_new' : 'dpl_old',
                jobStatus: promoted ? outcome : 'succeeded',
              },
            });
          if (path === '/v7/deployments')
            return json({
              deployments: [
                {
                  uid: 'dpl_new',
                  target: 'production',
                  state: 'READY',
                  meta: { flowboardSha: sha, flowboardTag: 'web/v0.1.0' },
                },
              ],
              pagination: { next: null },
            });
          if (path === '/v13/deployments/dpl_new') return json({ readyState: 'READY' });
          if (path === '/v10/projects/prj_test/promote/dpl_new') {
            promoted = true;
            return new globalThis.Response(null, { status: 202 });
          }
          assert.fail(`Unexpected ${path}`);
        },
      },
    );
    await assert.rejects(
      providers.vercel({ ...manifest, app: 'web', tag: 'web/v0.1.0' }),
      outcome === 'failed' ? /promotion failed/ : /timed out/,
    );
  });

test('Vercel rolling releases are rejected before any deployment write', async () => {
  const providers = createDeploymentProviders(
    { vercelToken: 'token', vercelProjectId: 'prj_test' },
    {
      assertCurrent: async () => {},
      fetch: async (_url, init) => {
        assert.equal(init.method, 'GET');
        return json({ name: 'flowboard-web', rollingRelease: { enabled: true } });
      },
    },
  );
  await assert.rejects(providers.vercel(manifest), /rolling releases/);
});

for (const correct of [true, false])
  test(`Vercel skipped promotion requires the exact current production target: ${correct}`, async () => {
    let time = 0;
    const methods = [];
    const providers = createDeploymentProviders(
      { vercelToken: 'token', vercelProjectId: 'prj_test', githubRepoId: '123' },
      {
        assertCurrent: async () => {},
        now: () => time,
        timeoutMs: 10,
        sleep: async () => {
          time += 10;
        },
        fetch: async (url, init) => {
          methods.push(init.method);
          const path = new URL(url).pathname;
          if (path === '/v9/projects/prj_test')
            return json({
              name: 'flowboard-web',
              targets: { production: { id: correct ? 'dpl_existing' : 'dpl_wrong' } },
              lastAliasRequest: {
                toDeploymentId: 'dpl_existing',
                type: 'promote',
                jobStatus: 'skipped',
              },
            });
          if (path === '/v7/deployments')
            return json({
              deployments: [
                {
                  uid: 'dpl_existing',
                  target: 'production',
                  state: 'READY',
                  meta: { flowboardSha: sha, flowboardTag: 'web/v0.1.0' },
                },
              ],
              pagination: { next: null },
            });
          if (path === '/v13/deployments/dpl_existing') return json({ readyState: 'READY' });
          if (path === '/v10/projects/prj_test/promote/dpl_existing') return json({});
          assert.fail(`Unexpected ${path}`);
        },
      },
    );
    const work = providers.vercel({ ...manifest, app: 'web', tag: 'web/v0.1.0' });
    if (correct) {
      await work;
      assert.ok(methods.every((method) => method === 'GET'));
    } else await assert.rejects(work, /timed out/);
  });
