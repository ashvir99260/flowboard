import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { exportOpenApi } from '@flowboard/api/spec';

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, ordered(item)]),
    );
  }

  return value;
}

const targetArgument = process.argv.find((value) => value.startsWith('--target='));
const target =
  targetArgument?.slice('--target='.length) ??
  fileURLToPath(new URL('../openapi.json', import.meta.url));
const output = JSON.stringify(ordered(await exportOpenApi()), null, 2) + '\n';
if (process.argv.includes('--write')) {
  await writeFile(target, output);
} else if ((await readFile(target, 'utf8')) !== output) {
  throw new Error('OpenAPI drift detected. Run pnpm gen:api and commit the generated changes.');
}
