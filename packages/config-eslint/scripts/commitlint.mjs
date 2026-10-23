import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const cli = createRequire(import.meta.url).resolve('@commitlint/cli/cli.js');
const config = path.join(root, 'commitlint.config.mjs');
const titleConfig = fileURLToPath(new URL('../src/commitlint-title.mjs', import.meta.url));

function git(cwd, args, trim = true) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(`Cannot read commit revision: ${result.error?.message ?? result.stderr}`);
  }
  return trim ? result.stdout.trim() : result.stdout;
}

function revision(value, cwd) {
  if (typeof value !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value)) {
    throw new Error('Invalid commit revision in event data');
  }
  git(cwd, ['rev-parse', '--verify', '--end-of-options', `${value}^{commit}`]);
  return value;
}

function validateMessage(message, strictTitle = false) {
  if (!message.trim()) throw new Error('Commit message must not be empty');
  const result = spawnSync(
    process.execPath,
    [cli, '--config', strictTitle ? titleConfig : config, '--cwd', root, '--color=false'],
    { cwd: root, encoding: 'utf8', input: message },
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      `Commit message validation failed:\n${result.error?.message ?? result.stdout + result.stderr}`,
    );
  }
}

function checkRange(range, cwd, last = false) {
  const args = ['log', '-z', '--format=%B', '--no-show-signature'];
  if (last) args.push('-1');
  const raw = git(cwd, [...args, range, '--'], false);
  const messages = raw ? raw.split('\0') : [];
  if (messages.length && messages.pop() !== '') throw new Error('Invalid commit message framing');
  for (const message of messages) validateMessage(message);
  return messages.length;
}

export function checkCiCommits(eventName, event, cwd = root) {
  let range;
  if (eventName === 'pull_request') {
    const pull = event.pull_request;
    if (typeof pull?.title !== 'string') throw new Error('Missing pull request title');
    validateMessage(pull.title, true);
    const base = revision(pull.base?.sha, cwd);
    const head = revision(pull.head?.sha, cwd);
    range = `${base}..${head}`;
  } else if (eventName === 'push') {
    const head = revision(event.after, cwd);
    range = /^0{40}$|^0{64}$/.test(event.before ?? '')
      ? head
      : `${revision(event.before, cwd)}..${head}`;
  } else if (eventName === 'workflow_dispatch') {
    range = git(cwd, ['rev-parse', 'HEAD']);
  } else {
    throw new Error(`Unsupported commit-check event: ${eventName}`);
  }
  return checkRange(range, cwd, eventName === 'workflow_dispatch');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2).filter((arg, index) => index !== 0 || arg !== '--');
    if (args[0] === '--ci') {
      const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
      const count = checkCiCommits(process.env.GITHUB_EVENT_NAME, event);
      console.log(`Commit policy passed for ${count} commit(s) and applicable PR title.`);
    } else if (args.length === 2 && args[0] === '--edit') {
      validateMessage(readFileSync(args[1], 'utf8'));
    } else if (args.length === 1 && args[0] === '--last') {
      checkRange('HEAD', root, true);
    } else if (args.length === 4 && args[0] === '--from' && args[2] === '--to') {
      const from = git(root, ['rev-parse', '--verify', '--end-of-options', `${args[1]}^{commit}`]);
      const to = git(root, ['rev-parse', '--verify', '--end-of-options', `${args[3]}^{commit}`]);
      checkRange(`${from}..${to}`, root);
    } else throw new Error('Use --edit <absolute-file>, --last, --from <ref> --to <ref>, or --ci.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
