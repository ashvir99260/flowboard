import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeDocument } from './document.mjs';
import { lintDocument } from './lint.mjs';

const target =
  process.argv.find((value) => value.startsWith('--target='))?.slice('--target='.length) ??
  fileURLToPath(new URL('../openapi.json', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'flowboard-openapi-'));
try {
  const generated = join(temporary, 'openapi.json');
  await writeDocument(generated);
  await lintDocument(generated);
  const [actual, committed] = await Promise.all([readFile(generated), readFile(target)]);
  if (!actual.equals(committed))
    throw new Error('OpenAPI drift detected. Run pnpm gen:api and commit the generated changes.');
} finally {
  await rm(temporary, { force: true, recursive: true });
}
