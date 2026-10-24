import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const gates = [
  ['pnpm', 'install', '--frozen-lockfile'],
  ...['build', 'lint', 'typecheck', 'format:check', 'openapi:check', 'client:check'].map((gate) => [
    'pnpm',
    gate,
  ]),
  ['pnpm', 'test', '--concurrency=2', '--continue'],
  ['pnpm', 'docker:check'],
  ['pnpm', 'docker:dev:check'],
];

export async function checkRelease({ source = root, commands = gates } = {}) {
  const git = async (...args) => (await execute('git', args, { cwd: source })).stdout.trim();
  assert.equal(
    await git('status', '--porcelain'),
    '',
    'Release verification requires a clean checkout',
  );
  const revision = await git('rev-parse', 'HEAD');
  const checkout = await mkdtemp(path.join(tmpdir(), 'flowboard-release-'));
  const logs = path.join(source, '.ai-local', 'release', path.basename(checkout));
  await mkdir(logs, { recursive: true });
  const env = Object.fromEntries(
    [
      'PATH',
      'HOME',
      'TMPDIR',
      'LANG',
      'LC_ALL',
      'DOCKER_HOST',
      'DOCKER_CONTEXT',
      'DOCKER_CONFIG',
      'PLAYWRIGHT_BROWSERS_PATH',
      'XDG_CACHE_HOME',
    ]
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]),
  );
  Object.assign(env, { CI: 'true', NEXT_TELEMETRY_DISABLED: '1' });
  try {
    // Copy local Git objects independently without repacking the entire history.
    await execute(
      'git',
      ['clone', '--quiet', '--no-hardlinks', '--no-checkout', source, checkout],
      { timeout: 60_000 },
    );
    await execute('git', ['checkout', '--quiet', '--detach', revision], { cwd: checkout });
    console.info(`Verify committed revision ${revision}; logs: ${logs}`);
    for (const [index, [command, ...args]] of commands.entries()) {
      const label = `${command} ${args.join(' ')}`;
      const log = path.join(logs, `${String(index + 1).padStart(2, '0')}.log`);
      console.info(`Running ${label}`);
      try {
        const { stdout, stderr } = await execute(command, args, {
          cwd: checkout,
          env,
          timeout: 1_800_000,
          maxBuffer: 64 * 1024 * 1024,
        });
        await writeFile(log, stdout + stderr);
        const actual = (
          await execute('git', ['rev-parse', 'HEAD'], { cwd: checkout })
        ).stdout.trim();
        assert.equal(actual, revision, 'A release gate changed the verified revision');
        const changed = (
          await execute('git', ['status', '--porcelain'], { cwd: checkout })
        ).stdout.trim();
        assert.equal(changed, '', 'A release gate modified the clean checkout');
      } catch (error) {
        await writeFile(log, `${error.stdout ?? ''}${error.stderr ?? ''}\n${error.message}`);
        throw new Error(`Release gate failed: ${label}; see ${log}`, { cause: error });
      }
    }
    assert.equal(
      await git('status', '--porcelain'),
      '',
      'Release verification modified its source',
    );
    console.info(`All clean-checkout release gates passed for ${revision}`);

    return { checkout, logs, revision };
  } finally {
    await rm(checkout, { force: true, recursive: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await checkRelease();
