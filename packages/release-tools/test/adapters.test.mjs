import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { githubPort } from '../dist/github.js';
import { ensureImage } from '../dist/images.js';
import { publishRelease } from '../dist/publisher.js';

const release = {
  app: 'api',
  version: '0.1.1',
  tag: 'api/v0.1.1',
  sha: 'a'.repeat(40),
  mode: 'new',
};
const digest = `sha256:${'b'.repeat(64)}`;
const image = 'ghcr.io/owner/flowboard-api';

async function dockerFixture(t, state) {
  const directory = await mkdtemp(join(tmpdir(), 'flowboard-docker-fixture-'));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const log = join(directory, 'commands.jsonl');
  await writeFile(join(directory, 'package.json'), JSON.stringify({ type: 'module' }));
  await writeFile(log, '');
  const executable = join(directory, 'docker');
  await writeFile(
    executable,
    `#!/usr/bin/env node
import fs from 'node:fs';
const state = ${JSON.stringify(state)};
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args)+'\\n');
if (args[0]==='buildx' && args[1]==='imagetools' && args[2]==='inspect') {
  if (state.registryError) { console.error('unauthorized'); process.exit(1); }
  const found = args[3].includes(':sha-') ? state.shaDigest : state.versionDigest;
  if (!found) { console.error('manifest unknown'); process.exit(1); }
  console.log(found);
} else if (args[0]==='image' && args[1]==='inspect') {
  console.log(JSON.stringify(state.labels || {}));
} else if (args[0]==='buildx' && args[1]==='build') {
  fs.writeFileSync(args[args.indexOf('--metadata-file')+1], JSON.stringify({'containerimage.digest': ${JSON.stringify(digest)}}));
}
`,
  );
  await chmod(executable, 0o755);
  const git = join(directory, 'git');
  await writeFile(
    git,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
console.log(args[0] === 'rev-parse' ? ${JSON.stringify(release.sha)} : ${JSON.stringify(state.dirty ? ' M apps/api/src/main.ts' : '')});
`,
  );
  await chmod(git, 0o755);
  const path = process.env.PATH;
  process.env.PATH = `${directory}:${path}`;
  t.after(() => {
    process.env.PATH = path;
  });
  return async () =>
    (await readFile(log, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
}

test('Docker publisher builds only selected app with immutable version/SHA tags', async (t) => {
  const commands = await dockerFixture(t, {});
  assert.equal(await ensureImage(release, image), digest);
  const build = (await commands()).find((args) => args[1] === 'build');
  assert.equal(build[build.indexOf('--file') + 1], 'apps/api/Dockerfile');
  assert.ok(build.includes(`${image}:0.1.1`));
  assert.ok(build.includes(`${image}:sha-${release.sha}`));
  assert.ok(build.includes('--push'));
});

test('Docker publisher reuses matching image and repairs only missing SHA tag', async (t) => {
  const commands = await dockerFixture(t, {
    versionDigest: digest,
    labels: {
      'org.opencontainers.image.revision': release.sha,
      'org.opencontainers.image.version': release.version,
      'org.opencontainers.image.title': release.app,
    },
  });
  assert.equal(await ensureImage(release, image), digest);
  const calls = await commands();
  assert.ok(!calls.some((args) => args[1] === 'build'));
  assert.ok(
    calls.some((args) => args.includes('create') && args.includes(`${image}:sha-${release.sha}`)),
  );
});

for (const [name, state, pattern] of [
  ['dirty source', { dirty: true }, /clean checkout/],
  ['wrong source', { labels: {}, versionDigest: digest }, /Conflicting existing image/],
  [
    'mismatched tags',
    { versionDigest: digest, shaDigest: `sha256:${'c'.repeat(64)}` },
    /Conflicting image tags/,
  ],
  ['authentication failure', { registryError: true }, /Cannot inspect registry/],
])
  test(`Docker publisher rejects ${name} without overwriting images`, async (t) => {
    const commands = await dockerFixture(t, state);
    await assert.rejects(ensureImage(release, image), pattern);
    assert.ok(
      !(await commands()).some((args) => args.includes('create') || args.includes('build')),
    );
  });

async function githubFixture(t) {
  const state = {
    failUpload: false,
    manifest: null,
    remote: null,
    tag: null,
    unauthorized: false,
    uploads: 0,
  };
  const requests = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    let text = '';
    for await (const chunk of request) text += chunk;
    const body = text ? JSON.parse(text) : null;
    const route = decodeURIComponent(url.pathname.replace('/repos/owner/flowboard', ''));
    requests.push([request.method, route]);
    response.setHeader('Content-Type', 'application/json');
    const send = (value, status = 200) => {
      response.statusCode = status;
      response.end(JSON.stringify(value));
    };
    if (state.unauthorized) return send({}, 401);
    assert.equal(request.headers.authorization, 'Bearer fixture-token');
    if (route === '/releases' && request.method === 'GET')
      return send(state.remote ? [state.remote] : []);
    if (route === '/git/refs' && request.method === 'POST') {
      state.tag = body.sha;
      return send({});
    }
    if (route === `/git/ref/tags/${release.tag}`)
      return state.tag ? send({ object: { sha: state.tag, type: 'commit' } }) : send({}, 404);
    if (route === '/releases' && request.method === 'POST') {
      state.remote = {
        id: 1,
        draft: true,
        tag_name: body.tag_name,
        upload_url: `${base}/uploads{?name,label}`,
        assets: [],
      };
      return send(state.remote, 201);
    }
    if (route === `/releases/tags/${release.tag}` || route === '/releases/1') {
      if (!state.remote || (route.startsWith('/releases/tags/') && state.remote.draft))
        return send({}, 404);
      if (request.method === 'PATCH') state.remote.draft = body.draft;
      return send(state.remote);
    }
    if (route === '/uploads') {
      if (state.failUpload) return send({}, 503);
      state.uploads++;
      state.manifest = body;
      state.remote.assets = [{ id: 2, name: 'release.json' }];
      return send({}, 201);
    }
    if (route === '/releases/assets/2') return send(state.manifest);
    return send({}, 404);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const github = githubPort('owner/flowboard', 'fixture-token', base);
  github.port.ensureImage = async () => digest;
  return { github, requests, state };
}

test('GitHub adapter creates explicit source tag, uploads manifest, publishes and safely retries', async (t) => {
  const { github, state, requests } = await githubFixture(t);
  assert.deepEqual(await github.publishedTags(), []);
  await publishRelease(release, 'owner/flowboard', github.port);
  assert.equal(state.tag, release.sha);
  assert.equal(state.remote.draft, false);
  assert.deepEqual(await github.publishedTags(), [release.tag]);
  await publishRelease(release, 'owner/flowboard', github.port);
  assert.equal(state.uploads, 1);
  assert.ok(
    requests.findIndex(([method, path]) => method === 'POST' && path === '/git/refs') <
      requests.findIndex(([method, path]) => method === 'POST' && path === '/releases'),
  );
});

test('GitHub adapter keeps a failed upload unpublished and resumes the same draft', async (t) => {
  const { github, state } = await githubFixture(t);
  state.failUpload = true;
  await assert.rejects(publishRelease(release, 'owner/flowboard', github.port), /503/);
  assert.equal(state.remote.draft, true);
  assert.deepEqual(await github.publishedTags(), []);
  state.failUpload = false;
  await publishRelease(release, 'owner/flowboard', github.port);
  assert.equal(state.remote.draft, false);
});

test('GitHub authorization failures are not mistaken for an empty release history', async (t) => {
  const { github, state } = await githubFixture(t);
  state.unauthorized = true;
  await assert.rejects(github.publishedTags(), /401/);
});
