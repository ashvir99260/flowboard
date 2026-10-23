import assert from 'node:assert/strict';
import { test } from 'node:test';

import { publishRelease } from '../dist/publisher.js';

const release = {
  app: 'api',
  version: '0.1.1',
  tag: 'api/v0.1.1',
  sha: 'a'.repeat(40),
  mode: 'new',
};
const digest = `sha256:${'b'.repeat(64)}`;
function fixture() {
  const calls = [];
  let remote = null;
  let tagSha = null;
  let manifest = null;
  const port = {
    async readRelease() {
      calls.push('read');

      return remote;
    },
    async readTag() {
      calls.push('tag');

      return tagSha;
    },
    async ensureImage() {
      calls.push('image');

      return digest;
    },
    async createTag() {
      calls.push('createTag');
      tagSha = release.sha;
    },
    async createDraft() {
      calls.push('draft');
      tagSha = release.sha;
      remote = { draft: true, id: 1 };

      return remote;
    },
    async readManifest() {
      return manifest;
    },
    async uploadManifest(_remote, value) {
      calls.push('manifest');
      manifest = value;
    },
    async publish() {
      calls.push('publish');
      remote.draft = false;
    },
  };

  return {
    port,
    calls,
    setRemote(value) {
      remote = value;
    },
    setTag(value) {
      tagSha = value;
    },
    getManifest() {
      return manifest;
    },
  };
}

test('publishes an image and verified draft manifest before making release public', async () => {
  const f = fixture();
  await publishRelease(release, 'owner/flowboard', f.port);
  assert.deepEqual(f.calls, [
    'read',
    'tag',
    'image',
    'createTag',
    'draft',
    'tag',
    'manifest',
    'publish',
  ]);
  assert.equal(f.getManifest().image, 'ghcr.io/owner/flowboard-api');
  assert.equal(f.getManifest().digest, digest);
  assert.equal(f.getManifest().sha, release.sha);
});

test('retry after publication skips rebuilding and republishing', async () => {
  const f = fixture();
  await publishRelease(release, 'owner/flowboard', f.port);
  f.calls.length = 0;
  await publishRelease(release, 'owner/flowboard', f.port);
  assert.deepEqual(f.calls, ['read', 'tag']);
});

test('image failure never creates a release', async () => {
  const f = fixture();
  f.port.ensureImage = async () => {
    throw new Error('registry unavailable');
  };
  await assert.rejects(publishRelease(release, 'owner/flowboard', f.port), /registry unavailable/);
  assert.ok(!f.calls.includes('draft'));
});

test('a draft resumes after upload failure', async () => {
  const f = fixture();
  const upload = f.port.uploadManifest;
  f.port.uploadManifest = async () => {
    throw new Error('upload failed');
  };
  await assert.rejects(publishRelease(release, 'owner/flowboard', f.port), /upload failed/);
  f.port.uploadManifest = upload;
  await publishRelease(release, 'owner/flowboard', f.port);
  assert.equal(f.calls.filter((call) => call === 'draft').length, 1);
  assert.equal(f.calls.filter((call) => call === 'publish').length, 1);
});

test('conflicting tag or published manifest is rejected without image writes', async () => {
  const f = fixture();
  f.setTag('c'.repeat(40));
  await assert.rejects(publishRelease(release, 'owner/flowboard', f.port), /Conflicting tag/);
  assert.ok(!f.calls.includes('image'));
  f.setTag(release.sha);
  f.setRemote({ draft: false, id: 1 });
  await assert.rejects(publishRelease(release, 'owner/flowboard', f.port), /manifest/);
  assert.ok(!f.calls.includes('image'));
});
