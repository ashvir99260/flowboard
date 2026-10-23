import { codeFiles } from './quality.mjs';

// Keep after eslint-config-prettier: it disables the underlying core rule.
export default {
  files: codeFiles,
  rules: {
    'padding-line-between-statements': [
      'error',
      { blankLine: 'always', next: '*', prev: ['export', 'if', 'return'] },
      { blankLine: 'always', next: 'return', prev: '*' },
    ],
  },
};
