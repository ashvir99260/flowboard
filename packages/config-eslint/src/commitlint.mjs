import { fileURLToPath } from 'node:url';

export default {
  defaultIgnores: false,
  extends: [fileURLToPath(import.meta.resolve('@commitlint/config-conventional'))],
  ignores: [
    (message) => /^(Merge (pull request|branch|remote-tracking branch)\b|Revert ")/.test(message),
  ],
  rules: {
    'header-max-length': [2, 'always', 100],
  },
};
