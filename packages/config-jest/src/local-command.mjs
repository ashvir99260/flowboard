import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startProcess } from './process.mjs';

// Exercise the actual package command without reading a developer's private .env.
export async function startLocalCommand(packageDirectory, scriptName, { env, envFile } = {}) {
  const directory = fileURLToPath(packageDirectory);
  const { scripts } = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  const command =
    scriptName === 'dev' ? scripts.dev.match(/--onSuccess "([^"]+)"/)?.[1] : scripts[scriptName];
  if (!command?.startsWith('node ')) throw new Error('Expected a Node startup command');

  const cwd = await mkdtemp(path.join(tmpdir(), 'flowboard-local-command-'));
  try {
    await symlink(path.join(directory, 'dist'), path.join(cwd, 'dist'), 'dir');
    if (envFile !== undefined) await writeFile(path.join(cwd, '.env'), envFile, { mode: 0o600 });

    const runtime = startProcess(command.split(' ').slice(1), { cwd, env });

    return {
      ...runtime,
      async stop(...args) {
        try {
          await runtime.stop(...args);
        } finally {
          await rm(cwd, { force: true, recursive: true });
        }
      },
    };
  } catch (error) {
    await rm(cwd, { force: true, recursive: true });
    throw error;
  }
}
