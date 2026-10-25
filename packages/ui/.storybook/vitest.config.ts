import { fileURLToPath } from 'node:url';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [storybookTest({ configDir: fileURLToPath(new URL('.', import.meta.url)) })],
  test: {
    name: 'ui-stories',
    // Bound browser contexts in local all-workspace runs and the dedicated CI job.
    fileParallelism: false,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
});
