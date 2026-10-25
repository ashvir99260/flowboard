import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const source = await readFile(new URL('../../../../compose.yaml', import.meta.url), 'utf8');
const environment = { ...process.env };
for (const [, key] of source.matchAll(/\$\{([A-Z_][A-Z0-9_]*)/g)) delete environment[key];

for (const key of [
  'COMPOSE_DISABLE_ENV_FILE',
  'COMPOSE_ENV_FILES',
  'COMPOSE_FILE',
  'COMPOSE_PROFILES',
  'COMPOSE_PROJECT_NAME',
])
  delete environment[key];

async function configuration(overrides = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'flowboard-compose-config-'));
  try {
    await writeFile(path.join(directory, 'compose.yaml'), source);
    const { stdout } = await execute('docker', ['compose', 'config', '--format', 'json'], {
      cwd: directory,
      env: { ...environment, PWD: directory, ...overrides },
      timeout: 30_000,
    });

    return JSON.parse(stdout);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

for (const [label, overrides] of [
  ['absent', {}],
  [
    'empty',
    Object.fromEntries([...source.matchAll(/\$\{([A-Z_][A-Z0-9_]*)/g)].map(([, key]) => [key, ''])),
  ],
]) {
  test(`Compose supplies the complete local preview with ${label} settings and no env files`, async () => {
    const { services, volumes } = await configuration(overrides);
    assert.deepEqual(Object.keys(services).sort(), ['api', 'postgres', 'redis', 'web', 'worker']);
    for (const service of Object.values(services)) assert.equal(service.env_file, undefined);

    assert.deepEqual(services.postgres.environment, {
      POSTGRES_DB: 'flowboard',
      POSTGRES_PASSWORD: 'flowboard-local-only',
      POSTGRES_USER: 'flowboard',
    });
    const databaseUrl =
      'postgresql://flowboard:flowboard-local-only@postgres:5432/flowboard?schema=public';
    assert.equal(services.api.environment.DATABASE_URL, databaseUrl);
    assert.equal(services.api.environment.DATABASE_URL_UNPOOLED, databaseUrl);
    assert.equal(services.worker.environment.DATABASE_URL, databaseUrl);
    assert.equal(services.api.environment.REDIS_URL, 'redis://redis:6379');
    assert.equal(services.worker.environment.REDIS_URL, 'redis://redis:6379');
    assert.equal(services.api.environment.DEMO_SEED, 'true');
    assert.equal(services.api.environment.API_DOCS, 'true');
    assert.equal(services.api.environment.AUTH_ALLOW_INSECURE_HTTP, 'true');
    assert.ok(services.api.environment.AUTH_SECRET.length >= 32);
    assert.equal(
      services.api.environment.AUTH_ALLOWED_ORIGINS,
      'http://localhost:3000,http://localhost:3001',
    );
    assert.equal(services.web.environment.API_INTERNAL_URL, 'http://api:3001');
    assert.equal(services.web.environment.REALTIME_PUBLIC_URL, 'http://localhost:3001');
    assert.equal(services.web.environment.WEB_ALLOWED_ORIGINS, 'http://localhost:3000');
    for (const [service, port] of [
      ['web', '3000'],
      ['api', '3001'],
    ]) {
      assert.equal(services[service].ports[0].host_ip, '127.0.0.1');
      assert.equal(services[service].ports[0].published, port);
    }

    for (const service of ['postgres', 'redis', 'worker'])
      assert.equal(services[service].ports, undefined);

    for (const service of ['api', 'worker']) {
      for (const dependency of ['postgres', 'redis']) {
        assert.equal(services[service].depends_on[dependency].condition, 'service_healthy');
      }
    }

    assert.equal(services.web.depends_on.api.condition, 'service_healthy');
    assert.equal(services.worker.depends_on.api.condition, 'service_healthy');
    assert.ok(services.postgres.healthcheck.test.length > 0);
    assert.ok(services.redis.healthcheck.test.length > 0);
    assert.deepEqual(Object.keys(volumes).sort(), ['postgres-data', 'redis-data']);
  });
}

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
    const { services } = await configuration(overrides);
    assert.equal(services.api.environment.AUTH_ALLOWED_ORIGINS, expected);
    const port = overrides.WEB_PORT ?? '3000';
    assert.equal(services.web.environment.WEB_ALLOWED_ORIGINS, `http://localhost:${port}`);
    assert.equal(
      services.web.environment.REALTIME_PUBLIC_URL,
      `http://localhost:${overrides.API_PORT ?? '3001'}`,
    );
  });
}
