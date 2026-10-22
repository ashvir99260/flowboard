import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

import { commonRules, ignoredFiles } from './common.mjs';

export default [{ ignores: ignoredFiles }, ...nextVitals, ...nextTypescript, commonRules, prettier];
