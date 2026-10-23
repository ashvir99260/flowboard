import importX from 'eslint-plugin-import-x';

import boundaries from './boundaries.mjs';

export const ignoredFiles = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/next-env.d.ts',
  '**/.ai-local/**',
  '**/.serena/**',
  '**/graphify-out/**',
  '**/.graphify_*',
  '**/*.gen.*',
  '**/src/generated/**',
  '**/openapi.json',
];

export const commonRules = {
  plugins: { flowboard: { rules: { boundaries } }, 'import-x': importX },
  rules: {
    'flowboard/boundaries': 'error',
    'import-x/no-commonjs': 'error',
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'node:module',
            importNames: ['createRequire', 'default'],
            message: 'Use native imports or import.meta.resolve for ESM.',
          },
          {
            name: 'module',
            importNames: ['createRequire', 'default'],
            message: 'Use native imports or import.meta.resolve for ESM.',
          },
        ],
      },
    ],
    'import-x/order': [
      'error',
      {
        alphabetize: { caseInsensitive: true, order: 'asc' },
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
        'newlines-between': 'always',
      },
    ],
  },
};
