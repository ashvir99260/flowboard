import importX from 'eslint-plugin-import-x';

import boundaries from './boundaries.mjs';

export const ignoredFiles = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/next-env.d.ts',
];

export const commonRules = {
  plugins: { 'import-x': importX, flowboard: { rules: { boundaries } } },
  rules: {
    'flowboard/boundaries': 'error',
    'import-x/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
  },
};
