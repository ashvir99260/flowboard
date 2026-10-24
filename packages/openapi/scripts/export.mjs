import { fileURLToPath } from 'node:url';

import { writeDocument } from './document.mjs';

const target =
  process.argv.find((value) => value.startsWith('--target='))?.slice('--target='.length) ??
  fileURLToPath(new URL('../openapi.json', import.meta.url));
if (process.argv.includes('--write')) {
  await writeDocument(target);
} else {
  await import('./check.mjs');
}
