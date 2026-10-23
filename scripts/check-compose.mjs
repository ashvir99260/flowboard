import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const project = `flowboard-check-${randomUUID().slice(0, 8)}`;
const env = {
  ...process.env,
  WEB_PORT: '0',
  API_PORT: '0',
  POSTGRES_DB: 'flowboard',
  POSTGRES_USER: 'flowboard',
  POSTGRES_PASSWORD: 'flowboard-check-only',
  DEMO_SEED: 'true',
  AUTH_SECRET: 'flowboard-docker-check-secret-abcdefghijklmnopqrstuvwxyz',
  AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
  AUTH_ALLOW_INSECURE_HTTP: 'true',
  LOG_LEVEL: 'debug',
};
const prefix = ['compose', '--project-name', project, '--file', 'compose.yaml'];

async function run(...args) {
  try {
    const operation = execute('docker', [...prefix, ...args], {
      cwd: root,
      env,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 1_800_000,
    });
    if (args.includes('--build')) {
      operation.child.stdout.on('data', (chunk) => process.stdout.write(chunk));
      operation.child.stderr.on('data', (chunk) => process.stdout.write(chunk));
    }
    const { stdout } = await operation;
    return stdout.trim();
  } catch (error) {
    throw new Error(`Docker check failed: ${args.join(' ')}\n${error.stderr ?? error.message}`);
  }
}

const config = JSON.parse(await run('config', '--format', 'json'));
assert.deepEqual(Object.keys(config.services).sort(), [
  'api',
  'postgres',
  'redis',
  'web',
  'worker',
]);
assert.equal(config.services.postgres.environment.POSTGRES_DB, 'flowboard');
assert.equal(config.services.postgres.environment.POSTGRES_USER, 'flowboard');
for (const service of ['api', 'worker']) {
  for (const dependency of ['postgres', 'redis']) {
    assert.equal(config.services[service].depends_on[dependency].condition, 'service_healthy');
  }
}
assert.equal(config.services.web.depends_on.api.condition, 'service_healthy');
assert.equal(config.services.postgres.ports, undefined, 'PostgreSQL is private by default');
assert.equal(config.services.redis.ports, undefined, 'Redis is private by default');

if (process.argv.includes('--config-only')) {
  console.info('Compose configuration checks passed; no containers were started');
  process.exit(0);
}

try {
  console.info(`[${project}] Build images and wait for all five services`);
  await run('up', '--build', '--detach', '--wait', '--wait-timeout', '180');

  for (const service of ['api', 'web', 'worker']) {
    const uid = await run('exec', '-T', service, 'node', '-p', 'process.getuid()');
    assert.notEqual(uid, '0', `${service} must run as non-root`);
  }
  const webAddress = await run('port', 'web', '3000');
  const apiAddress = await run('port', 'api', '3001');
  const page = await fetch(`http://${webAddress}`, { signal: AbortSignal.timeout(10_000) });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Application foundation is ready/);
  const asset = html.match(/src="([^"]*\/_next\/static\/[^"]+)"/);
  assert.ok(asset, 'The web image references compiled browser assets');
  const assetResponse = await fetch(`http://${webAddress}${asset[1]}`, {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(assetResponse.status, 200);
  const ready = await fetch(`http://${apiAddress}/health/ready`);
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { status: 'ready' });
  const docs = await fetch(`http://${apiAddress}/docs/`);
  assert.equal(docs.status, 200);
  const api = await fetch(`http://${apiAddress}/v1/tasks`, {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(api.status, 404, 'The shell must not claim a domain API exists');
  const login = await fetch(`http://${apiAddress}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ email: 'alice@example.com', password: 'FlowboardDemo123!' }),
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(login.status, 200);
  const session = await login.json();
  assert.equal(session.data.activeWorkspace.role, 'admin');
  assert.equal(session.data.user.email, 'alice@example.com');
  assert.ok(login.headers.get('set-cookie').includes('HttpOnly'));
  const logOutput = await run('logs', '--no-color', '--no-log-prefix', 'api', 'worker');
  const logRecords = logOutput
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line));
  const loginTrace = logRecords.filter(
    ({ requestId }) => requestId === login.headers.get('x-request-id'),
  );
  assert.ok(
    loginTrace.some(
      ({ event, operation }) =>
        event === 'operation.completed' && operation === 'database.identity',
    ),
  );
  assert.ok(
    loginTrace.some(
      ({ event, userId }) => event === 'http.completed' && userId === session.data.user.id,
    ),
  );
  assert.ok(
    logRecords.some(
      ({ event, outcome }) => event === 'worker.started' && outcome === 'process_only',
    ),
  );
  for (const secret of [
    env.AUTH_SECRET,
    env.POSTGRES_PASSWORD,
    'FlowboardDemo123!',
    session.data.accessToken,
    login.headers.get('set-cookie'),
  ]) {
    assert.ok(!logOutput.includes(secret), 'Runtime logs must exclude credentials');
  }

  console.info(`[${project}] Verify persistent PostgreSQL and Redis data across restart`);
  const psql = ['exec', '-T', 'postgres', 'psql', '-U', 'flowboard', '-d', 'flowboard', '-tAc'];
  assert.equal(await run(...psql, 'SELECT count(*) FROM tasks;'), '27');
  assert.equal(await run(...psql, 'SELECT count(*) FROM seed_states;'), '1');
  assert.equal(
    await run(
      ...psql,
      "SELECT count((entry->>'id')::uuid) FROM field_definitions CROSS JOIN LATERAL jsonb_array_elements(options) AS entry;",
    ),
    '4',
  );
  await run(
    ...psql,
    "UPDATE tasks SET title='Preserve this local edit' WHERE id=(SELECT id FROM tasks ORDER BY id LIMIT 1);",
  );
  await run(
    ...psql,
    "CREATE TABLE delivery_probe(value text); INSERT INTO delivery_probe VALUES ('retained');",
  );
  await run('exec', '-T', 'redis', 'redis-cli', 'SET', 'delivery-probe', 'retained');
  await run('restart', 'postgres', 'redis', 'api', 'worker', 'web');
  await run('up', '--detach', '--wait', '--wait-timeout', '180');
  assert.equal(await run(...psql, 'SELECT value FROM delivery_probe;'), 'retained');
  assert.equal(await run(...psql, 'SELECT count(*) FROM tasks;'), '27');
  assert.equal(
    await run(...psql, "SELECT count(*) FROM tasks WHERE title='Preserve this local edit';"),
    '1',
  );
  assert.equal(await run('exec', '-T', 'redis', 'redis-cli', 'GET', 'delivery-probe'), 'retained');
  const restartedAddress = await run('port', 'web', '3000');
  const restarted = await fetch(`http://${restartedAddress}`, {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(restarted.status, 200);
  const restartLogs = await run('logs', '--no-color', '--no-log-prefix', 'api', 'worker');
  assert.ok(restartLogs.includes('"event":"api.stopped"'));
  assert.ok(restartLogs.includes('"event":"worker.stopped"'));
  console.info(`[${project}] All Docker acceptance checks passed`);
} finally {
  // The random project name isolates this run from the user's development stack.
  // Volumes are retained; this command never deletes database storage.
  await run('down', '--timeout', '15');
  console.info(`[${project}] Test containers removed; isolated volumes retained`);
}
