import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { startRealApp } from './common/real-app-fixture.mjs';

const specs = (await readdir(new URL('../e2e/', import.meta.url)))
  .filter((file) => file.endsWith('.spec.ts'))
  .sort();
assert.ok(specs.length, 'Real-service Playwright journeys are required');
for (const file of specs) {
  test(`real API and PostgreSQL browser acceptance: ${file}`, { timeout: 180_000 }, async (t) => {
    const app = await startRealApp(t, { activityWorker: true, realtime: true });
    const result = await promisify(execFile)(
      process.execPath,
      [
        fileURLToPath(import.meta.resolve('@playwright/test/cli')),
        'test',
        file,
        '--output',
        fileURLToPath(new URL(`../../../.ai-local/p1201/playwright/${file}/`, import.meta.url)),
        '--config',
        'playwright.config.ts',
      ],
      {
        cwd: new URL('../', import.meta.url),
        env: { ...process.env, FLOWBOARD_E2E_URL: app.origin },
        timeout: 120_000,
        maxBuffer: 1024 * 1024,
      },
    ).catch((error) => {
      throw new Error(`${error.stdout ?? ''}\n${error.stderr ?? ''}`, { cause: error });
    });
    assert.match(result.stdout, /[1-9]\d* passed/);
    assert.doesNotMatch(result.stdout, /\d+ (?:failed|skipped)|did not run/);
    t.diagnostic(
      `Playwright ${file} passed against isolated real API, PostgreSQL, Redis and worker services.`,
    );
  });
}
