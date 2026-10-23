import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));

export function installHooks(cwd = root) {
  const existing = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
    cwd,
    encoding: 'utf8',
  });
  if (existing.error || (existing.status !== 0 && existing.status !== 1)) {
    throw new Error(`Cannot inspect existing hooks: ${existing.error?.message ?? existing.stderr}`);
  }
  if (existing.stdout.trim() && existing.stdout.trim() !== '.githooks') {
    throw new Error(
      `Preserving existing hooksPath: ${existing.stdout.trim()}. Integrate commitlint there explicitly.`,
    );
  }
  const result = spawnSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], {
    cwd,
    encoding: 'utf8',
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Cannot install local hooks: ${result.error?.message ?? result.stderr}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    installHooks();
    console.log('Repository-local commit-msg hook enabled.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
