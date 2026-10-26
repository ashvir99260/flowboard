import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createDeploymentProviders } from '../dist/deployment-providers.js';

const sha = 'a'.repeat(40);
const source = { sha, tags: ['api/v0.1.0', 'web/v0.1.0', 'worker/v0.1.0'] };
const config = {
  githubRepoId: '123',
  vercelProjectId: 'prj_test',
  vercelTeamId: 'team_test',
  vercelToken: 'fixture-token',
};
const meta = { flowboardSha: sha, flowboardTags: source.tags.join(',') };
const envs = [
  'PORT',
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'REDIS_URL',
  'AUTH_SECRET',
  'AUTH_ALLOWED_ORIGINS',
  'WEB_ALLOWED_ORIGINS',
  'REALTIME_PUBLIC_URL',
].map((key) => ({ key, target: ['production'] }));
const services = [
  { framework: 'nextjs', name: 'web', builder: { use: '@vercel/next' } },
  { name: 'api', runtime: 'container', builder: { use: '@vercel/container' } },
];
const daemon = {
  config: {
    image: { requested: 'worker:source', resolved: 'worker@sha256:fixture' },
    instances: { cle1: 1 },
    resources: { requests: { memory: '2Gi' } },
  },
  createdAt: '2026-10-26T00:00:00.000Z',
  deploymentId: 'dpl_services',
  instances: {
    desired: 1,
    items: [
      { alive: true, id: 'dmni_fixture', region: 'cle1', startedAt: '2026-10-26T00:00:00.000Z' },
    ],
    ready: 1,
    total: 1,
  },
  name: 'worker',
  scope: { type: 'target', value: 'production' },
  status: 'ready',
  updatedAt: '2026-10-26T00:00:01.000Z',
};
const ready = {
  gitSource: { type: 'github', repoId: '123', sha },
  id: 'dpl_services',
  lambdas: [
    {
      id: 'bld_fixture',
      output: [{ functionName: 'api-handler', path: '__fn_api__' }],
      readyState: 'READY',
    },
  ],
  meta,
  projectId: config.vercelProjectId,
  readyState: 'READY',
  services,
  target: 'production',
  url: 'flowboard-demo.vercel.app',
};
const json = (data, status = 200) => new globalThis.Response(JSON.stringify(data), { status });

function fixture(overrides = {}) {
  const calls = [];
  const project = {
    id: config.vercelProjectId,
    accountId: config.vercelTeamId,
    framework: 'services',
    link: { repoId: 123, type: 'github' },
    name: 'flowboard',
    rootDirectory: null,
    ...overrides.project,
  };
  let time = 0;
  let listingCount = 0;
  let daemonCount = 0;
  const provider = createDeploymentProviders(config, {
    assertCurrent: overrides.assertCurrent ?? (async () => {}),
    now: () => time,
    timeoutMs: 10,
    sleep: async () => {
      time += 10;
    },
    fetch: async (url, init) => {
      const parsed = new URL(url);
      const body = init.body ? JSON.parse(init.body) : undefined;
      calls.push({ path: parsed.pathname, query: parsed.searchParams, method: init.method, body });
      assert.equal(parsed.origin, 'https://api.vercel.com');
      assert.equal(init.redirect, 'error');
      assert.equal(init.headers.Authorization, 'Bearer fixture-token');
      if (parsed.pathname === '/v9/projects/prj_test') return json(project);

      if (parsed.pathname === '/v2/teams/team_test')
        return json({ id: 'team_test', billing: { plan: 'hobby' }, ...overrides.team });

      if (parsed.pathname === '/v10/projects/prj_test/env') {
        assert.equal(parsed.searchParams.get('decrypt'), 'false');

        return json({ envs: overrides.envs ?? envs });
      }

      if (parsed.pathname === '/v7/deployments') {
        assert.equal(parsed.searchParams.get('target'), 'production');
        assert.equal(parsed.searchParams.get('sha'), sha);

        return json(
          overrides.listing?.(++listingCount, parsed.searchParams) ?? { deployments: [] },
        );
      }

      if (parsed.pathname === '/v13/deployments') return json({ id: ready.id });

      if (parsed.pathname === '/v13/deployments/dpl_services') {
        assert.equal(parsed.searchParams.get('withGitRepoInfo'), 'true');

        return overrides.read ? overrides.read() : json({ ...ready, ...overrides.ready });
      }

      if (parsed.pathname === '/v1/projects/prj_test/daemons') {
        assert.equal(parsed.searchParams.get('scopeType'), 'target');
        assert.equal(parsed.searchParams.get('scopeValue'), 'production');
        assert.equal(parsed.searchParams.get('limit'), '100');

        return json(
          overrides.daemons?.(++daemonCount, parsed.searchParams) ?? {
            daemons: [daemon],
            pagination: { count: 1 },
          },
        );
      }

      assert.fail(`Unexpected provider request ${parsed.pathname}`);
    },
  });

  return { calls, provider };
}

test('one production deployment builds all services at the exact validated source SHA', async () => {
  const { calls, provider } = fixture();
  assert.equal(await provider.vercel(source), 'https://flowboard-demo.vercel.app');
  const writes = calls.filter((call) => call.method !== 'GET');
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].body, {
    name: 'flowboard',
    project: config.vercelProjectId,
    target: 'production',
    projectSettings: { framework: 'services', rootDirectory: null },
    gitSource: { type: 'github', repoId: '123', ref: sha, sha },
    meta,
  });
});

test('Ohio worker satisfies readiness for the colocated deployment', async () => {
  const { provider } = fixture({
    daemons: () => ({
      daemons: [
        {
          ...daemon,
          instances: {
            ...daemon.instances,
            items: [{ ...daemon.instances.items[0], region: 'cle1' }],
          },
        },
      ],
    }),
  });
  assert.equal(await provider.vercel(source), 'https://flowboard-demo.vercel.app');
});

test('a stopped worker from the previous region does not block Ohio readiness', async () => {
  const { provider } = fixture({
    daemons: () => ({
      daemons: [
        {
          ...daemon,
          instances: {
            ...daemon.instances,
            items: [
              daemon.instances.items[0],
              { ...daemon.instances.items[0], region: 'iad1', stoppedAt: '2026-10-26T01:00:00Z' },
            ],
            total: 2,
          },
        },
      ],
    }),
  });
  assert.equal(await provider.vercel(source), 'https://flowboard-demo.vercel.app');
});

test('retry pages past preview and mismatched releases and reuses a matching production deployment', async () => {
  const { calls, provider } = fixture({
    listing: (page, query) => {
      if (page === 1)
        return { deployments: [{ ...ready, target: null }], pagination: { next: 50 } };

      assert.equal(query.get('until'), '50');

      return { deployments: [{ ...ready, state: 'BUILDING' }] };
    },
  });
  await provider.vercel(source);
  assert.equal(calls.filter((call) => call.method === 'POST').length, 0);
});

for (const [name, options] of [
  ['paid account', { team: { billing: { plan: 'pro' } } }],
  ['unknown account plan', { team: { billing: null } }],
  ['different team', { team: { id: 'team_other' } }],
  ['foreign project', { project: { id: 'prj_other' } }],
  ['foreign owner', { project: { accountId: 'team_other' } }],
  ['wrong framework', { project: { framework: 'nextjs' } }],
  ['nested project root', { project: { rootDirectory: 'apps/web' } }],
  ['foreign GitHub repository', { project: { link: { repoId: 999, type: 'github' } } }],
  ['wrong git provider', { project: { link: { repoId: 123, type: 'gitlab' } } }],
  ['missing environment', { envs: envs.filter(({ key }) => key !== 'AUTH_SECRET') }],
  ['missing container port', { envs: envs.filter(({ key }) => key !== 'PORT') }],
  [
    'missing direct database URL',
    { envs: envs.filter(({ key }) => key !== 'DATABASE_URL_UNPOOLED') },
  ],
  ['preview-only environment', { envs: envs.map((env) => ({ ...env, target: ['preview'] })) }],
])
  test(`preflight rejects ${name} before any deployment mutation`, async () => {
    const { calls, provider } = fixture(options);
    await assert.rejects(provider.vercel(source), /Vercel|environment/);
    assert.equal(calls.filter((call) => call.method === 'POST').length, 0);
  });

for (const state of ['ERROR', 'CANCELED', 'BLOCKED', 'BUILDING'])
  test(`${state} deployment is not reported ready`, async () => {
    const { provider } = fixture({
      listing: () => ({ deployments: [{ ...ready, state: 'BUILDING' }] }),
      ready: { readyState: state },
    });
    await assert.rejects(provider.vercel(source), state === 'BUILDING' ? /timed out/ : /failed/);
  });

for (const patch of [
  { target: null },
  { projectId: 'prj_other' },
  { gitSource: { ...ready.gitSource, sha: 'c'.repeat(40) } },
  { gitSource: { ...ready.gitSource, repoId: '999' } },
  { gitSource: undefined },
  { meta: { ...meta, flowboardTags: 'web/v0.0.1' } },
  { url: 'https://user:password@flowboard.vercel.app' },
  { url: 'attacker.example' },
  { services: services.filter(({ name }) => name !== 'web') },
  { services: undefined },
  { lambdas: [] },
  { lambdas: [{ id: 'bld_fixture', output: [], readyState: 'ERROR' }] },
  {
    services: [
      { framework: 'nextjs', name: 'web' },
      { name: 'api', runtime: 'node' },
    ],
  },
])
  test(`ready response rejects mismatched source, topology or URL: ${JSON.stringify(patch)}`, async () => {
    const { provider } = fixture({ ready: patch });
    await assert.rejects(provider.vercel(source), /Invalid Vercel/);
  });

test('repeated pagination cursors are rejected rather than spinning', async () => {
  const { calls, provider } = fixture({
    listing: () => ({ deployments: [], pagination: { next: 50 } }),
  });
  await assert.rejects(provider.vercel(source), /Repeated Vercel pagination cursor/);
  assert.equal(calls.filter((call) => call.method === 'POST').length, 0);
});

for (const [name, patch] of [
  ['different deployment', { deploymentId: 'dpl_other' }],
  ['preview scope', { scope: { type: 'target', value: 'preview' } }],
  ['stopped daemon', { status: 'stopped' }],
  ['unready instance', { instances: { ...daemon.instances, ready: 0 } }],
  ['disabled worker', { instances: { ...daemon.instances, desired: 0 } }],
  [
    'worker in another region',
    {
      instances: { ...daemon.instances, items: [{ ...daemon.instances.items[0], region: 'iad1' }] },
    },
  ],
  [
    'overlapping worker in another region',
    {
      instances: {
        ...daemon.instances,
        items: [daemon.instances.items[0], { ...daemon.instances.items[0], region: 'iad1' }],
        total: 2,
      },
    },
  ],
  [
    'dead instance',
    { instances: { ...daemon.instances, items: [{ ...daemon.instances.items[0], alive: false }] } },
  ],
])
  test(`ready deployment waits for its live worker: ${name}`, async () => {
    const { provider } = fixture({ daemons: () => ({ daemons: [{ ...daemon, ...patch }] }) });
    await assert.rejects(provider.vercel(source), /timed out/);
  });

test('worker readiness pages through daemon inventory and waits for a live instance', async () => {
  const { provider } = fixture({
    daemons: (page, query) => {
      if (!query.has('cursor'))
        return { daemons: [], pagination: { count: 0, next: 'next-worker' } };

      assert.equal(query.get('cursor'), 'next-worker');

      return { daemons: [{ ...daemon, status: page < 4 ? 'reconciling' : 'ready' }] };
    },
  });
  assert.equal(await provider.vercel(source), 'https://flowboard-demo.vercel.app');
});

test('repeated daemon cursors fail rather than spinning', async () => {
  const { provider } = fixture({ daemons: () => ({ daemons: [], pagination: { next: 'same' } }) });
  await assert.rejects(provider.vercel(source), /Repeated Vercel daemon cursor/);
});

test('a main revision changing after preflight cannot create a production deployment', async () => {
  const { calls, provider } = fixture({
    assertCurrent: async () => {
      throw new Error('stale main');
    },
  });
  await assert.rejects(provider.vercel(source), /stale main/);
  assert.equal(calls.filter((call) => call.method === 'POST').length, 0);
});

test('provider errors do not disclose response bodies or environment secrets', async () => {
  const { provider } = fixture({ read: () => json({ message: 'sensitive-value' }, 403) });
  await assert.rejects(
    provider.vercel(source),
    (error) => /403/.test(error.message) && !error.message.includes('sensitive-value'),
  );
});

test('malformed provider JSON is redacted instead of exposing its response body', async () => {
  const { provider } = fixture({
    read: () => new globalThis.Response('sensitive-value is not JSON'),
  });
  await assert.rejects(provider.vercel(source), {
    message: 'Invalid deployment provider response',
  });
});
