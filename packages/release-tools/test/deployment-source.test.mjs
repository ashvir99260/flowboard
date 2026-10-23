import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';

import { githubPort } from '../dist/github.js';

const sha = 'a'.repeat(40);
async function source(t) {
  const manifest = {
    schemaVersion: 1,
    app: 'api',
    version: '0.1.0',
    tag: 'api/v0.1.0',
    sha,
    image: 'ghcr.io/owner/flowboard-api',
    digest: `sha256:${'b'.repeat(64)}`,
  };
  const state = { manifest, main: sha, ancestry: null };
  const server = createServer((req, res) => {
    const path = decodeURIComponent(
      new URL(req.url, 'http://localhost').pathname.replace('/repos/owner/flowboard', ''),
    );
    let value;
    if (path === '/releases')
      value = [
        { id: 1, tag_name: 'api/v0.1.0', draft: false, target_commitish: sha },
        { id: 2, tag_name: 'api/v0.0.1', draft: false, target_commitish: 'main' },
        { id: 3, tag_name: 'worker/v0.1.0', draft: true, target_commitish: sha },
      ];
    else if (path.startsWith('/compare/'))
      value = { status: state.ancestry ?? (path.endsWith(sha) ? 'identical' : 'ahead') };
    else if (path === '/git/ref/heads/main')
      value = { object: { sha: state.main, type: 'commit' } };
    else if (path === '/git/ref/tags/api/v0.1.0') value = { object: { sha, type: 'commit' } };
    else if (path === '/releases/1')
      value = { id: 1, draft: false, assets: [{ id: 10, name: 'release.json' }] };
    else if (path === '/releases/assets/10') value = state.manifest;
    else {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(value));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return {
    state,
    github: githubPort(
      'owner/flowboard',
      'fixture-token',
      `http://127.0.0.1:${server.address().port}`,
    ),
  };
}

test('deployment retry recovers the latest completed manifest, excluding drafts and older versions', async (t) => {
  const { state, github } = await source(t);
  assert.deepEqual(await github.releasedManifests(sha), [state.manifest]);
});

test('deployment rejects a tampered release manifest and a stale branch', async (t) => {
  const { state, github } = await source(t);
  state.manifest.sha = 'c'.repeat(40);
  await assert.rejects(github.releasedManifests(sha), /manifest/);
  state.main = 'd'.repeat(40);
  await assert.rejects(github.assertCurrentMain(sha), /Stale/);
});

test('later merges recover the latest published app even when its source is an ancestor', async (t) => {
  const { github } = await source(t);
  const laterMain = 'd'.repeat(40);
  assert.equal((await github.releasedManifests(laterMain))[0].sha, sha);
});

test('an unrelated release history cannot be deployed as a current release', async (t) => {
  const { github, state } = await source(t);
  state.ancestry = 'diverged';
  await assert.rejects(github.releasedManifests('d'.repeat(40)), /not an ancestor/);
});
