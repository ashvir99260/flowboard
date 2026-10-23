import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

import { commonRules, ignoredFiles } from './common.mjs';
import json from './json.mjs';
import quality, { codeFiles } from './quality.mjs';
import spacing from './spacing.mjs';

export default defineConfig([
  { ignores: ignoredFiles },
  {
    files: codeFiles,
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      {
        languageOptions: {
          globals: {
            AbortController: 'readonly',
            AbortSignal: 'readonly',
            Buffer: 'readonly',
            clearInterval: 'readonly',
            clearTimeout: 'readonly',
            console: 'readonly',
            fetch: 'readonly',
            process: 'readonly',
            setInterval: 'readonly',
            setTimeout: 'readonly',
            URL: 'readonly',
          },
        },
      },
      commonRules,
      quality,
    ],
  },
  ...json,
  prettier,
  spacing,
]);
