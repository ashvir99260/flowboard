import { codeFiles } from './quality.mjs';

// Keep after Prettier compatibility; this rule changes whitespace only.
export default {
  files: codeFiles,
  rules: { 'flowboard/hook-spacing': 'error' },
};
