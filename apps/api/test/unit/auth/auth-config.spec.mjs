import { expect, test } from '@jest/globals';

import { readAuthSettings } from '../../../dist/auth/config/auth.config.js';
import { AuthTestSecret as secret } from '../../common/auth-fixtures.mjs';

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
