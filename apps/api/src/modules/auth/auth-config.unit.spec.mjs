import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import { expect, test } from '@jest/globals';

import { readAuthSettings } from '../../../dist/modules/auth/auth.config.js';
import { AuthTestSecret as secret } from '../../../test/common/auth-fixtures.mjs';

test.each([
  ['root', new URL('../../../../../.env.example', import.meta.url)],
  ['API', new URL('../../../.env.example', import.meta.url)],
])('%s local example explicitly allows the web and Swagger origins', (_name, path) => {
  const environment = parseEnv(readFileSync(path, 'utf8'));
  const settings = readAuthSettings({ ...environment, AUTH_SECRET: secret });
  expect(settings.allowedOrigins).toEqual(['http://localhost:3000', 'http://localhost:3001']);
  expect(settings.insecureHttp).toBe(true);
});

test('unsafe or incomplete auth configuration is rejected', () => {
  expect(() => readAuthSettings({ AUTH_SECRET: 'short' })).toThrow();
  expect(() =>
    readAuthSettings({ AUTH_SECRET: secret, AUTH_ALLOWED_ORIGINS: 'http://flowboard.test' }),
  ).toThrow();
  expect(() =>
    readAuthSettings({
      AUTH_SECRET: secret,
      AUTH_ALLOWED_ORIGINS: 'https://flowboard.test',
      AUTH_ALLOW_INSECURE_HTTP: 'true',
    }),
  ).toThrow();
  expect(
    readAuthSettings({
      AUTH_SECRET: secret,
      AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
      AUTH_ALLOW_INSECURE_HTTP: 'true',
    }).insecureHttp,
  ).toBe(true);
});
