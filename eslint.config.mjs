import next from '@flowboard/config-eslint/next';
import node from '@flowboard/config-eslint/node';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.serena/**'] },
  { files: ['**/*.{js,mjs,cjs,ts,tsx}'], ignores: ['apps/web/**'], extends: [node] },
  {
    files: ['apps/web/**/*.{js,mjs,ts,tsx}'],
    extends: [next],
    settings: { next: { rootDir: 'apps/web' } },
  },
]);
