import { defineConfig } from 'eslint/config';
import jsonc from 'eslint-plugin-jsonc';

import exactDependencyVersions from './exact-dependency-versions.mjs';

export default defineConfig([
  {
    files: ['**/*.json'],
    extends: [jsonc.configs['flat/recommended-with-json']],
  },
  {
    files: ['**/*.jsonc'],
    extends: [jsonc.configs['flat/recommended-with-jsonc']],
  },
  {
    files: ['**/*.{json,jsonc}'],
    rules: {
      'jsonc/sort-keys': ['error', { order: { natural: true, type: 'asc' }, pathPattern: '.*' }],
    },
  },
  {
    files: ['**/package.json'],
    plugins: {
      flowboard: { rules: { 'require-exact-dependency-versions': exactDependencyVersions } },
    },
    rules: {
      'flowboard/require-exact-dependency-versions': 'error',
      'jsonc/sort-keys': 'off',
    },
  },
]);
