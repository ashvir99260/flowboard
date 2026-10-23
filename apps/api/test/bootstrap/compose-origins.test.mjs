import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../../../../', import.meta.url));

for (const [label, overrides, expected] of [
  ['defaults', {}, 'http://localhost:3000,http://localhost:3001'],
  [
    'custom published ports',
    { API_PORT: '3101', WEB_PORT: '3100' },
    'http://localhost:3100,http://localhost:3101',
  ],
  [
    'explicit allowlist',
    { API_PORT: '3101', AUTH_ALLOWED_ORIGINS: 'https://preview.example.test' },
    'https://preview.example.test',
  ],
]) {
  test(`Compose origin configuration respects ${label}`, async () => {
    const env = { ...process.env };
    for (const key of ['AUTH_ALLOWED_ORIGINS', 'WEB_PORT', 'API_PORT']) delete env[key];

    const { stdout } = await execute(
      'docker',
      ['compose', '--env-file', '/dev/null', '-f', 'compose.yaml', 'config', '--format', 'json'],
      { cwd: root, env: { ...env, ...overrides }, timeout: 30_000 },
    );
    const { services } = JSON.parse(stdout);
    assert.equal(services.api.environment.AUTH_ALLOWED_ORIGINS, expected);
  });
}
