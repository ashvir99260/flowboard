import prettier from 'eslint-config-prettier/flat';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

import node from './node.mjs';
import { codeFiles, jsxQuality } from './quality.mjs';
import reactSpacing from './react-spacing.mjs';
import spacing from './spacing.mjs';

export default [
  ...node,
  {
    files: ['**/*.{jsx,tsx}'],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'jsx-a11y': jsxA11y, react },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react/prop-types': 'off',
    },
  },
  {
    files: codeFiles,
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  jsxQuality,
  prettier,
  spacing,
  reactSpacing,
];
