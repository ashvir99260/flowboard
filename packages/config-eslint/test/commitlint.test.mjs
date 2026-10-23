import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkCiCommits } from '../scripts/commitlint.mjs';
import { installHooks } from '../scripts/install-hooks.mjs';

const root = await mkdtemp(path.join(tmpdir(), 'flowboard commits '));
const cli = fileURLToPath(new URL('../scripts/commitlint.mjs', import.meta.url));
after(() => rm(root, { force: true, recursive: true }));

function git(...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
git('init', '--quiet');
git('config', 'user.name', 'Commit Tests');
git('config', 'user.email', 'commit-tests@example.com');
git('config', 'commit.gpgsign', 'false');
git('-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '--allow-empty', '-m', 'chore: initial');
const base = git('rev-parse', 'HEAD');
git(
  '-c',
  'core.hooksPath=/dev/null',
  'commit',
  '--quiet',
  '--allow-empty',
  '-m',
  'feat: add board',
);
const head = git('rev-parse', 'HEAD');

for (const message of [
  'feat: add a board',
  'fix(api)!: change task input\n\nBREAKING CHANGE: new input',
  'docs: update guide',
]) {
  test(`accepts ${message.split('\n')[0]}`, async () => {
    const file = path.join(root, 'message with spaces.txt');
    await writeFile(file, message);
    const result = spawnSync(process.execPath, [cli, '--edit', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr + result.stdout);
  });
}

for (const message of ['update stuff', 'wrong: add board', 'feat:', '', '   ', 'v1.2.3']) {
  test(`rejects ${message}`, async () => {
    const file = path.join(root, 'invalid message.txt');
    await writeFile(file, message);
    const result = spawnSync(process.execPath, [cli, '--edit', file], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
  });
}

const pullRequest = (title) => ({
  pull_request: { base: { sha: base }, head: { sha: head }, title },
});

test('CI validates both actual PR commits and the proposed squash title', async () => {
  assert.equal(checkCiCommits('pull_request', pullRequest('feat: ship board'), root), 1);
  assert.throws(() => checkCiCommits('pull_request', pullRequest('ship board'), root), /commit/i);
  assert.throws(
    () => checkCiCommits('pull_request', pullRequest('Merge branch example'), root),
    /commit/i,
  );
});

test('event text is data, even when it contains shell syntax', () => {
  const marker = path.join('/private/tmp', `flowboard-no-shell-${process.pid}`);
  checkCiCommits('pull_request', pullRequest(`feat: handle $(touch '${marker}')`), root);
  return assert.rejects(readFile(marker), { code: 'ENOENT' });
});

test('CI fails closed on missing or malformed revisions', () => {
  assert.throws(
    () => checkCiCommits('push', { after: head, before: 'HEAD; echo unsafe' }, root),
    /revision/i,
  );
  assert.throws(
    () => checkCiCommits('push', { before: 'f'.repeat(40), after: head }, root),
    /revision/i,
  );
});

test('first-push zero base checks all reachable commits', () => {
  assert.equal(checkCiCommits('push', { before: '0'.repeat(40), after: head }, root), 2);
});

test('CI rejects an actual empty-message commit instead of dropping it', () => {
  git(
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '--quiet',
    '--allow-empty',
    '--allow-empty-message',
    '-m',
    '',
  );
  const emptyHead = git('rev-parse', 'HEAD');
  assert.throws(() => checkCiCommits('push', { after: emptyHead, before: head }, root), /empty/i);
});

test('local hook setup is idempotent and preserves another configured hook path', () => {
  installHooks(root);
  assert.equal(git('config', '--local', '--get', 'core.hooksPath'), '.githooks');
  installHooks(root);
  git('config', '--local', 'core.hooksPath', '.other-hooks');
  assert.throws(() => installHooks(root), /existing/i);
  assert.equal(git('config', '--local', '--get', 'core.hooksPath'), '.other-hooks');
});

test('the real hook blocks invalid commits from a worktree with spaces', async () => {
  const hooks = path.join(root, '.githooks');
  await mkdir(hooks);
  await copyFile(
    new URL('../../../.githooks/commit-msg', import.meta.url),
    path.join(hooks, 'commit-msg'),
  );
  await chmod(path.join(hooks, 'commit-msg'), 0o755);
  git('add', '.githooks/commit-msg');
  git('-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'chore: add test hook');
  git('config', '--local', '--unset', 'core.hooksPath');
  const worktree = `${root} worktree`;
  git('worktree', 'add', '--detach', worktree, 'HEAD');
  const bin = path.join(root, 'bin');
  await mkdir(bin);
  const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  await writeFile(
    path.join(bin, 'pnpm'),
    `#!/bin/sh\nshift\nexec ${quote(process.execPath)} ${quote(cli)} "$@"\n`,
  );
  await chmod(path.join(bin, 'pnpm'), 0o755);
  try {
    installHooks(worktree);
    const run = (message) =>
      spawnSync('git', ['commit', '--allow-empty', '-m', message], {
        cwd: worktree,
        env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
        encoding: 'utf8',
      });
    assert.notEqual(run('invalid message').status, 0);
    const valid = run('chore: verify worktree hook');
    assert.equal(valid.status, 0, valid.stderr + valid.stdout);
  } finally {
    git('worktree', 'remove', '--force', worktree);
  }
});
