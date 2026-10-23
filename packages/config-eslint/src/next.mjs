import { defineConfig } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

import { commonRules, ignoredFiles } from './common.mjs';
import json from './json.mjs';
import quality, { codeFiles, jsxQuality } from './quality.mjs';

export default defineConfig([
  { ignores: ignoredFiles },
  {
    files: codeFiles,
    extends: [...nextVitals, ...nextTypescript, commonRules, quality, jsxQuality],
  },
  ...json,
  prettier,
]);
