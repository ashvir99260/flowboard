import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

async function fixture(t) {
  const source = await mkdtemp(path.join(tmpdir(), 'flowboard-release-test-'));
  t.after(() => rm(source, { force: true, recursive: true }));
  git(source, 'init', '--quiet');
  await writeFile(path.join(source, '.gitignore'), '.env\n.ai-local/\n');
  await writeFile(path.join(source, 'tracked.txt'), 'committed');
  git(source, 'add', '.');
  git(
    source,
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '--quiet',
    '-m',
    'test: fixture',
  );
  await writeFile(path.join(source, '.env'), 'SECRET=never-copy');

  return source;
}

test('release checks use the committed tree without ignored files and remove their copy', async (t) => {
  const { checkRelease } = await import('../../../scripts/check-release.mjs');
  const source = await fixture(t);
  const result = await checkRelease({
    source,
    commands: [
      [
        process.execPath,
        '-e',
        "const fs=require('node:fs'); if(fs.existsSync('.env')||fs.readFileSync('tracked.txt','utf8')!=='committed') process.exit(1); fs.writeFileSync('.env','isolated'); console.log(process.cwd());",
      ],
    ],
  });
  assert.equal(result.revision, git(source, 'rev-parse', 'HEAD'));
  assert.equal(existsSync(result.checkout), false);
  assert.equal(await readFile(path.join(source, 'tracked.txt'), 'utf8'), 'committed');
  assert.match(await readFile(path.join(result.logs, '01.log'), 'utf8'), /flowboard-release-/);
});

test('release checks refuse uncommitted code and stop after a failed gate', async (t) => {
  const { checkRelease } = await import('../../../scripts/check-release.mjs');
  const source = await fixture(t);
  await writeFile(path.join(source, 'tracked.txt'), 'dirty');
  await assert.rejects(checkRelease({ source, commands: [] }), /clean checkout/);
  git(source, 'checkout', '--', 'tracked.txt');
  const marker = path.join(source, 'should-not-run');
  await assert.rejects(
    checkRelease({
      source,
      commands: [
        [process.execPath, '-e', 'process.exit(9)'],
        [
          process.execPath,
          '-e',
          `require('node:fs').writeFileSync(${JSON.stringify(marker)},'bad')`,
        ],
      ],
    }),
    /failed/,
  );
  assert.equal(existsSync(marker), false);
});

test('release checks reject mutations to the verified committed tree', async (t) => {
  const { checkRelease } = await import('../../../scripts/check-release.mjs');
  const source = await fixture(t);
  await assert.rejects(
    checkRelease({
      source,
      commands: [
        [process.execPath, '-e', "require('node:fs').writeFileSync('tracked.txt','changed')"],
      ],
    }),
    /failed/,
  );
  assert.equal(await readFile(path.join(source, 'tracked.txt'), 'utf8'), 'committed');
});
