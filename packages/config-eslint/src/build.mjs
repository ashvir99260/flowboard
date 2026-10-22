import { cp, mkdir, readdir } from 'node:fs/promises';

await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
for (const file of await readdir(new URL('./', import.meta.url))) {
  if (file.endsWith('.mjs') && file !== 'build.mjs') {
    await cp(new URL(file, import.meta.url), new URL(`../dist/${file}`, import.meta.url));
  }
}
