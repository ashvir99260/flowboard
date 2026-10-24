import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { startRealApp } from './common/real-app-fixture.mjs';

test('real API and PostgreSQL browser acceptance', { timeout: 120_000 }, async (t) => {
  const app = await startRealApp(t);
  const result = await promisify(execFile)(
    process.execPath,
    [
      fileURLToPath(import.meta.resolve('@playwright/test/cli')),
      'test',
      '--config',
      'playwright.config.ts',
    ],
    {
      cwd: new URL('../', import.meta.url),
      env: { ...process.env, FLOWBOARD_E2E_URL: app.origin },
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
    },
  ).catch((error) => {
    throw new Error(`${error.stdout ?? ''}\n${error.stderr ?? ''}`, { cause: error });
  });
  assert.match(result.stdout, /1 passed/);
  t.diagnostic(
    'Playwright login/list/field-save/reload and separate Bob permissions passed against the real API.',
  );
});
