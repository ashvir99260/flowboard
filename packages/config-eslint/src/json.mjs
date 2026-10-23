import { defineConfig } from 'eslint/config';
import jsonc from 'eslint-plugin-jsonc';

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
    rules: {
      'jsonc/sort-keys': [
        'error',
        {
          order: { natural: true, type: 'asc' },
          pathPattern: '^(?!(?:exports|imports)(?:\\.|\\[|$)).*$',
        },
      ],
    },
  },
]);
