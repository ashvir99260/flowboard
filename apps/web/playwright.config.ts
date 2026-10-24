import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: 'list',
  outputDir: '../../.ai-local/p0904/playwright',
  use: { baseURL: process.env.FLOWBOARD_E2E_URL, headless: true, trace: 'retain-on-failure' },
});
