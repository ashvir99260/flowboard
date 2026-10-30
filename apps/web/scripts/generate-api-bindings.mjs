import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readApiInventory, renderApiBindings } from './api-bindings.mjs';

// Build-only input. Runtime code imports the API client's public exports.
const input =
  process.argv.find((arg) => arg.startsWith('--input='))?.slice('--input='.length) ??
  fileURLToPath(new URL('../../../packages/api-client/src/generated/', import.meta.url));
const target =
  process.argv.find((arg) => arg.startsWith('--target='))?.slice('--target='.length) ??
  fileURLToPath(new URL('../src/generated/apiHooks.gen.ts', import.meta.url));
const output = renderApiBindings(await readApiInventory(input));
const siblings = await readdir(path.dirname(target)).catch((error) => {
  if (error.code === 'ENOENT') return [];

  throw error;
});
if (siblings.some((name) => name !== path.basename(target)))
  throw new Error('Generated UI API bindings contain unexpected sibling output.');

if (process.argv.includes('--write')) {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, output);
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
} else {
  const current = await readFile(target, 'utf8').catch(() => null);
  if (current !== output) throw new Error('Generated UI API bindings drifted. Run pnpm gen:api.');
}
