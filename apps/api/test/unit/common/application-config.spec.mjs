import { expect, test } from '@jest/globals';

import { readApplicationConfig } from '../../../dist/core/config/application.config.js';

const environment = {
  DATABASE_URL: 'postgresql://example.test/flowboard',
  REDIS_URL: 'redis://example.test',
};

test('application configuration preserves defaults and explicit runtime settings', () => {
  expect(readApplicationConfig(environment)).toEqual({
    databaseUrl: environment.DATABASE_URL,
    redisUrl: environment.REDIS_URL,
    host: '127.0.0.1',
    port: 3001,
    demoSeed: false,
    exposeDocs: true,
  });
  expect(
    readApplicationConfig({
      ...environment,
      PORT: '0',
      HOST: '0.0.0.0',
      NODE_ENV: 'production',
      DEMO_SEED: 'true',
      DATABASE_URL_UNPOOLED: 'postgresql://direct.example.test/flowboard',
    }),
  ).toEqual({
    databaseUrl: environment.DATABASE_URL,
    redisUrl: environment.REDIS_URL,
    directDatabaseUrl: 'postgresql://direct.example.test/flowboard',
    host: '0.0.0.0',
    port: 0,
    demoSeed: true,
    exposeDocs: false,
  });
});

test('runtime flags reject unknown values and do not log secret values', () => {
  for (const name of ['API_DOCS', 'DEMO_SEED']) {
    expect(() => readApplicationConfig({ ...environment, [name]: 'secret-invalid' })).toThrow(
      `${name} must be true or false`,
    );
  }
  for (const port of ['not-a-port', '-1', '65536', '1.5']) {
    expect(() => readApplicationConfig({ ...environment, PORT: port })).toThrow(
      'PORT must be an integer between 0 and 65535',
    );
  }
  expect(() => readApplicationConfig({ REDIS_URL: environment.REDIS_URL })).toThrow(
    'DATABASE_URL is required',
  );
  expect(() => readApplicationConfig({ DATABASE_URL: environment.DATABASE_URL })).toThrow(
    'REDIS_URL is required',
  );
});

test('explicit docs flags override environment defaults including legacy empty values', () => {
  expect(
    readApplicationConfig({ ...environment, NODE_ENV: 'production', API_DOCS: 'true' }).exposeDocs,
  ).toBe(true);
  expect(readApplicationConfig({ ...environment, API_DOCS: 'false' }).exposeDocs).toBe(false);
  expect(readApplicationConfig({ ...environment, API_DOCS: '' }).exposeDocs).toBe(false);
  expect(readApplicationConfig({ ...environment, DEMO_SEED: '' }).demoSeed).toBe(false);
});
