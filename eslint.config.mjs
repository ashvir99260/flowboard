import json from '@flowboard/config-eslint/json';
import next from '@flowboard/config-eslint/next';
import node from '@flowboard/config-eslint/node';
import react from '@flowboard/config-eslint/react';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.serena/**',
      '**/.ai-local/**',
      '**/graphify-out/**',
    ],
  },
  {
    extends: [node],
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    ignores: ['apps/web/**', 'packages/ui/**'],
  },
  {
    extends: [next],
    files: ['apps/web/**/*.{js,mjs,ts,tsx}'],
    settings: { next: { rootDir: 'apps/web' } },
  },
  { extends: [react], files: ['packages/ui/**/*.{js,mjs,ts,tsx}'] },
  ...json,
]);
