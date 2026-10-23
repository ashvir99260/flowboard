import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { stringify } from 'yaml';

import { planReleases } from '../dist/index.js';

const apps = ['api', 'web', 'worker'];
async function fixture(t) {
  const cwd = await mkdtemp(join(tmpdir(), 'flowboard-release-'));
  t.after(() => rm(cwd, { force: true, recursive: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const put = async (path, value) => {
    await mkdir(dirname(join(cwd, path)), { recursive: true });
    await writeFile(join(cwd, path), typeof value === 'string' ? value : JSON.stringify(value));
  };
  const commit = (message) => {
    git('add', '.');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', message);

    return git('rev-parse', 'HEAD');
  };
  git('init', '-q');
  await put('package.json', {
    devDependencies: { turbo: '2.11.10' },
    packageManager: 'pnpm@12.15.0',
  });
  await put('pnpm-workspace.yaml', 'packages: [apps/*, packages/*]\n');
  await put('turbo.json', { tasks: { build: { dependsOn: ['^build'], outputs: ['dist/**'] } } });
  const lock = { importers: {}, packages: {}, snapshots: {} };
  for (const name of [
    ...apps,
    'contracts',
    'database',
    'logger',
    'ui',
    'api-client',
    'config-typescript',
    'openapi',
  ]) {
    const path = `${apps.includes(name) ? 'apps' : 'packages'}/${name}`;
    const deps =
      name === 'web'
        ? ['contracts', 'ui', 'api-client']
        : ['api', 'worker'].includes(name)
          ? ['contracts', 'database', 'logger']
          : [];
    const manifest = {
      name: `@flowboard/${name}`,
      dependencies: Object.fromEntries(deps.map((dep) => [`@flowboard/${dep}`, 'workspace:*'])),
    };
    await put(`${path}/package.json`, manifest);
    await put(`${path}/src/index.ts`, `export const name = '${name}';\n`);
    lock.importers[path] = {
      dependencies: Object.fromEntries(
        deps.map((dep) => [`@flowboard/${dep}`, { version: `link:../../packages/${dep}` }]),
      ),
    };
  }
  const saveLock = () =>
    put('pnpm-lock.yaml', `---\n${stringify({ importers: { '.': {} } })}---\n${stringify(lock)}`);
  await saveLock();
  const base = commit('chore: initial');
  const publishedTags = apps.map((app) => `${app}/v0.1.0`);
  for (const tag of publishedTags) git('tag', tag);

  return {
    cwd,
    git,
    put,
    commit,
    base,
    publishedTags,
    lock,
    saveLock,
    plan: (options = {}) => planReleases({ cwd, publishedTags, ...options }),
  };
}

test('API-only change publishes only the API patch', async (t) => {
  const f = await fixture(t);
  await f.put('apps/api/src/index.ts', 'export const fixed = true;');
  const sha = f.commit('fix(api): handle invalid input');
  assert.deepEqual(await f.plan(), [
    {
      app: 'api',
      mode: 'new',
      previousTag: 'api/v0.1.0',
      sha,
      tag: 'api/v0.1.1',
      version: '0.1.1',
    },
  ]);
});

for (const [path, expected] of [
  ['apps/web/src/index.ts', ['web']],
  ['apps/worker/src/index.ts', ['worker']],
  ['packages/database/src/index.ts', ['api', 'worker']],
  ['packages/logger/src/index.ts', ['api', 'worker']],
  ['packages/ui/src/index.ts', ['web']],
  ['packages/api-client/src/index.ts', ['web']],
  ['packages/contracts/src/index.ts', apps],
  ['packages/config-typescript/base.json', apps],
  ['.dockerignore', apps],
])
  test(`${path} releases its consumers`, async (t) => {
    const f = await fixture(t);
    await f.put(path, 'changed');
    f.commit('fix: changed input');
    assert.deepEqual(
      (await f.plan()).map((release) => release.app),
      expected,
    );
  });

test('first publication starts every application at 0.1.0', async (t) => {
  const f = await fixture(t);
  for (const tag of f.publishedTags) f.git('tag', '-d', tag);
  assert.deepEqual(
    (await f.plan({ publishedTags: [] })).map((r) => r.tag),
    apps.map((app) => `${app}/v0.1.0`),
  );
});

test('docs, tests and build-only spec tooling do not release an application', async (t) => {
  const f = await fixture(t);
  for (const path of [
    'README.md',
    'apps/api/test/new.test.ts',
    'apps/api/src/modules/auth/auth-guard.unit.spec.mjs',
    'apps/api/src/modules/platform/health.integration.spec.mjs',
    'apps/web/src/item.test.ts',
    'packages/openapi/src/index.ts',
    'packages/config-eslint/index.js',
  ])
    await f.put(path, 'changed');
  f.commit('feat!: tooling changes');
  assert.deepEqual(await f.plan(), []);
});

for (const [message, version] of [
  ['feat(api): add endpoint', '0.2.0'],
  ['feat(api)!: replace endpoint', '1.0.0'],
  ['fix(api): endpoint\n\nBREAKING CHANGE: format changed', '1.0.0'],
  ['refactor(api): simplify', '0.1.1'],
])
  test(`${message.split('\n')[0]} chooses ${version}`, async (t) => {
    const f = await fixture(t);
    await f.put('apps/api/src/index.ts', 'changed');
    f.commit(message);
    assert.equal((await f.plan())[0].version, version);
  });

test('unrelated breaking changes do not inflate a later API fix', async (t) => {
  const f = await fixture(t);
  await f.put('apps/web/src/index.ts', 'breaking web');
  f.commit('feat(web)!: web change');
  await f.put('apps/api/src/index.ts', 'API fix');
  f.commit('fix(api): fix');
  assert.equal((await f.plan()).find((r) => r.app === 'api').version, '0.1.1');
});

test('rename/deletion release the owning app; a complete revert does not', async (t) => {
  const f = await fixture(t);
  f.git('mv', 'apps/api/src/index.ts', 'apps/api/src/renamed.ts');
  f.commit('refactor: rename');
  assert.deepEqual(
    (await f.plan()).map((r) => r.app),
    ['api'],
  );
  f.git('rm', 'apps/api/src/renamed.ts');
  f.commit('fix: delete');
  assert.equal((await f.plan())[0].app, 'api');
  await f.put('apps/api/src/index.ts', "export const name = 'api';\n");
  f.commit('revert: restore');
  assert.deepEqual(await f.plan(), []);
});

test('per-app baselines do not lose a shared change after partial publication', async (t) => {
  const f = await fixture(t);
  await f.put('packages/contracts/src/index.ts', 'shared');
  const sha = f.commit('feat: shared');
  f.git('tag', 'web/v0.2.0');
  const result = await f.plan({ publishedTags: [...f.publishedTags, 'web/v0.2.0'] });
  assert.deepEqual(
    result.map((r) => [r.app, r.version, r.sha]),
    [
      ['api', '0.2.0', sha],
      ['worker', '0.2.0', sha],
    ],
  );
});

test('an unfinished same-SHA tag resumes, while an unexpected version fails', async (t) => {
  const f = await fixture(t);
  await f.put('apps/api/src/index.ts', 'fix');
  f.commit('fix: API');
  f.git('tag', 'api/v0.1.1');
  assert.equal((await f.plan())[0].mode, 'resume');
  f.git('tag', 'api/v9.0.0');
  assert.throws(() => f.plan(), /Conflicting api tag/);
});

test('pending older publication must be repaired before advancing', async (t) => {
  const f = await fixture(t);
  await f.put('apps/api/src/index.ts', 'one');
  f.commit('fix: one');
  f.git('tag', 'api/v0.1.1');
  await f.put('apps/api/src/index.ts', 'two');
  f.commit('fix: two');
  assert.throws(() => f.plan(), /Unfinished api tag/);
});

test('published retries and stale targets skip; divergent history fails', async (t) => {
  const f = await fixture(t);
  await f.put('apps/api/src/index.ts', 'fix');
  f.commit('fix: API');
  f.git('tag', 'api/v0.1.1');
  const publishedTags = [...f.publishedTags, 'api/v0.1.1'];
  assert.deepEqual(await f.plan({ publishedTags }), []);
  assert.deepEqual(await f.plan({ publishedTags, sha: f.base }), []);
  f.git('checkout', '-q', '-b', 'diverged', f.base);
  await f.put('apps/api/src/index.ts', 'different');
  f.commit('fix: different');
  assert.throws(() => f.plan({ publishedTags }), /Diverged api history/);
});

test('annotated tags sort numerically and dereference to commits', async (t) => {
  const f = await fixture(t);
  f.git(
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.com',
    'tag',
    '-a',
    'api/v0.10.0',
    '-m',
    'release',
  );
  await f.put('apps/api/src/index.ts', 'fix');
  f.commit('fix: API');
  assert.equal(
    (await f.plan({ publishedTags: [...f.publishedTags, 'api/v0.10.0'] }))[0].version,
    '0.10.1',
  );
});

test('lockfile changes track reachable transitive and peer-qualified dependencies only', async (t) => {
  const f = await fixture(t);
  const dependency = '@example/runtime';
  const manifest = { name: '@flowboard/api', dependencies: { [dependency]: '1.0.0' } };
  await f.put('apps/api/package.json', manifest);
  f.lock.importers['apps/api'].dependencies[dependency] = { version: '1.0.0(peer@1.0.0)' };
  f.lock.snapshots['@example/runtime@1.0.0(peer@1.0.0)'] = { dependencies: { child: '1.0.0' } };
  f.lock.packages['@example/runtime@1.0.0'] = { resolution: { integrity: 'runtime' } };
  f.lock.snapshots['child@1.0.0'] = {};
  f.lock.packages['child@1.0.0'] = { resolution: { integrity: 'child-v1' } };
  await f.saveLock();
  f.commit('fix: add runtime');
  f.git('tag', 'api/v0.1.1');
  const publishedTags = [...f.publishedTags, 'api/v0.1.1'];
  f.lock.packages['unused@1.0.0'] = {};
  f.lock.snapshots['unused@1.0.0'] = {};
  await f.saveLock();
  f.commit('chore: unrelated lock change');
  assert.deepEqual(await f.plan({ publishedTags }), []);
  f.lock.packages['child@1.0.0'].resolution.integrity = 'child-v2';
  await f.saveLock();
  f.commit('fix: runtime lock change');
  assert.deepEqual(
    (await f.plan({ publishedTags })).map((r) => [r.app, r.version]),
    [['api', '0.1.2']],
  );
});

test('an unbootstrapped repository fails instead of publishing empty application images', async (t) => {
  const f = await fixture(t);
  for (const tag of f.publishedTags) f.git('tag', '-d', tag);
  f.git('rm', '-r', 'apps');
  f.commit('chore: remove apps');
  assert.throws(() => f.plan({ publishedTags: [] }), /Missing workspace @flowboard\/api/);
});

test('unresolved locked dependencies fail closed', async (t) => {
  const f = await fixture(t);
  await f.put('apps/api/package.json', {
    dependencies: { missing: '1.0.0' },
    name: '@flowboard/api',
  });
  f.commit('fix: broken dependency');
  assert.throws(() => f.plan(), /Missing locked dependency missing/);
});

test('single-document lockfiles work and package-manager document changes affect all apps', async (t) => {
  const f = await fixture(t);
  await f.put('pnpm-lock.yaml', stringify(f.lock));
  f.commit('chore: single document');
  assert.deepEqual(
    (await f.plan()).map((r) => r.app),
    apps,
  );
  for (const app of apps) f.git('tag', `${app}/v0.1.1`);
  const publishedTags = [...f.publishedTags, ...apps.map((app) => `${app}/v0.1.1`)];
  await f.put('apps/web/src/index.ts', 'single-document web change');
  f.commit('fix: web');
  assert.deepEqual(
    (await f.plan({ publishedTags })).map((r) => r.app),
    ['web'],
  );
});

test('removing a runtime workspace dependency still releases its former consumer', async (t) => {
  const f = await fixture(t);
  await f.put('apps/web/package.json', {
    dependencies: { '@flowboard/api-client': 'workspace:*', '@flowboard/contracts': 'workspace:*' },
    name: '@flowboard/web',
  });
  f.git('rm', '-r', 'packages/ui');
  f.commit('fix: remove unused UI package');
  assert.deepEqual(
    (await f.plan()).map((r) => r.app),
    ['web'],
  );
});

test('package import mapping changes ship to consumers', async (t) => {
  const f = await fixture(t);
  await f.put('packages/ui/package.json', {
    imports: { '#style': './src/style.js' },
    name: '@flowboard/ui',
  });
  f.commit('fix: runtime import mapping');
  assert.deepEqual(
    (await f.plan()).map((r) => r.app),
    ['web'],
  );
});

test('a valid final commit tolerates an intermediate unlocked dependency', async (t) => {
  const f = await fixture(t);
  await f.put('apps/api/package.json', {
    dependencies: { library: '1.0.0' },
    name: '@flowboard/api',
  });
  f.commit('feat(api): add library');
  f.lock.importers['apps/api'].dependencies.library = { version: '1.0.0' };
  f.lock.packages['library@1.0.0'] = { resolution: { integrity: 'test' } };
  f.lock.snapshots['library@1.0.0'] = {};
  await f.saveLock();
  f.commit('chore: lock library');
  assert.equal((await f.plan())[0].version, '0.2.0');
});

for (const tag of ['api/v01.2.3', 'api/v999999999999999999.0.0'])
  test(`invalid SemVer tag fails: ${tag}`, async (t) => {
    const f = await fixture(t);
    f.git('tag', tag);
    assert.throws(
      () => f.plan({ publishedTags: [...f.publishedTags, tag] }),
      /Unsupported application tag/,
    );
  });
