import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const project = `flowboard-check-${randomUUID().slice(0, 8)}`;
const fixture = await mkdtemp(path.join(tmpdir(), 'flowboard-compose-'));
async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  return {
    port: server.address().port,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
const reservations = await Promise.all([reservePort(), reservePort()]);
const webOrigin = `http://localhost:${reservations[0].port}`;
const apiOrigin = `http://localhost:${reservations[1].port}`;
// Exercise Compose's local defaults, independent of the caller's app configuration.
const composeSource = await readFile(path.join(root, 'compose.yaml'), 'utf8');
const inheritedEnvironment = { ...process.env };
for (const [, key] of composeSource.matchAll(/\$\{([A-Z_][A-Z0-9_]*)/g)) {
  delete inheritedEnvironment[key];
}

const env = {
  ...inheritedEnvironment,
  WEB_PORT: String(reservations[0].port),
  API_PORT: String(reservations[1].port),
  LOG_LEVEL: 'debug',
};
const images = ['api', 'web', 'worker'].map((service) => `${project}-${service}`);
const override = path.join(fixture, 'compose.json');
await writeFile(
  override,
  JSON.stringify({
    services: Object.fromEntries(
      ['api', 'web', 'worker'].map((service, index) => [service, { image: images[index] }]),
    ),
  }),
);
const prefix = [
  'compose',
  '--env-file',
  '/dev/null',
  '--project-name',
  project,
  '--file',
  'compose.yaml',
  '--file',
  override,
];

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
  await Promise.all(reservations.map(({ close }) => close()));
  await rm(fixture, { force: true, recursive: true });
  console.info('Compose configuration checks passed; no containers were started');
  process.exit(0);
}

try {
  await Promise.all(reservations.map(({ close }) => close()));
  console.info(`[${project}] Build the no-env preview and wait for all five services`);
  await run('up', '--build', '--detach', '--wait', '--wait-timeout', '180');

  for (const service of ['api', 'web', 'worker']) {
    const uid = await run('exec', '-T', service, 'node', '-p', 'process.getuid()');
    assert.notEqual(uid, '0', `${service} must run as non-root`);
    await run(
      'exec',
      '-T',
      service,
      'node',
      '--input-type=module',
      '-e',
      "import assert from 'node:assert/strict'; import { existsSync } from 'node:fs'; for (const name of ['.env', '.env.local', 'apps/api/.env', 'apps/worker/.env', 'apps/web/.env', 'apps/web/.env.local']) assert.equal(existsSync(name), false, 'Private env files must not enter images');",
    );
  }
  await run(
    'exec',
    '-T',
    'api',
    'node',
    '--input-type=module',
    '-e',
    "import assert from 'node:assert/strict'; import { existsSync, readdirSync } from 'node:fs'; assert.equal(existsSync('src'), false); assert.equal(existsSync('test'), false); assert.equal(readdirSync('dist', { recursive: true }).some(path => /\\.spec\\./.test(path)), false);",
  );
  const webAddress = await run('port', 'web', '3000');
  const apiAddress = await run('port', 'api', '3001');
  const page = await fetch(`http://${webAddress}`, { signal: AbortSignal.timeout(10_000) });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Organize your work/);
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
  const login = await fetch(`http://${apiAddress}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: webOrigin },
    body: JSON.stringify({ email: 'alice@example.com', password: 'FlowboardDemo123!' }),
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(login.status, 200);
  const session = await login.json();
  assert.equal(session.data.activeWorkspace.role, 'admin');
  assert.equal(session.data.user.email, 'alice@example.com');
  assert.ok(login.headers.get('set-cookie').includes('HttpOnly'));
  const proxyLogin = await fetch(`http://${webAddress}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: webOrigin },
    body: JSON.stringify({ email: 'alice@example.com', password: 'FlowboardDemo123!' }),
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(proxyLogin.status, 200);
  const proxySession = await proxyLogin.json();
  assert.equal(proxySession.data.user.email, 'alice@example.com');
  const initialCookie = proxyLogin.headers.getSetCookie()[0];
  assert.ok(initialCookie.includes('HttpOnly'));
  const proxyRefresh = await fetch(`http://${webAddress}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: initialCookie.split(';')[0], Origin: webOrigin },
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(proxyRefresh.status, 200);
  const refreshedSession = await proxyRefresh.json();
  const rotatedCookie = proxyRefresh.headers.getSetCookie()[0];
  assert.notEqual(rotatedCookie, initialCookie);
  const proxyLogout = await fetch(`http://${webAddress}/api/v1/auth/logout`, {
    method: 'POST',
    headers: { Cookie: rotatedCookie.split(';')[0], Origin: webOrigin },
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(proxyLogout.status, 204);
  assert.ok(proxyLogout.headers.getSetCookie()[0].includes('Max-Age=0'));

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
      ({ event, outcome }) => event === 'worker.started' && outcome === 'activity_worker',
    ),
  );
  for (const secret of [
    config.services.api.environment.AUTH_SECRET,
    config.services.postgres.environment.POSTGRES_PASSWORD,
    'FlowboardDemo123!',
    session.data.accessToken,
    proxySession.data.accessToken,
    refreshedSession.data.accessToken,
    initialCookie,
    rotatedCookie,
    login.headers.get('set-cookie'),
  ]) {
    assert.ok(!logOutput.includes(secret), 'Runtime logs must exclude credentials');
  }

  console.info(`[${project}] Run the real browser journey against production images`);
  const browser = await execute(
    'pnpm',
    ['--filter', '@flowboard/web', 'exec', 'playwright', 'test', 'task-edit.spec.ts'],
    {
      cwd: root,
      env: { ...env, FLOWBOARD_E2E_URL: webOrigin },
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  assert.match(browser.stdout, /1 passed/);
  assert.doesNotMatch(browser.stdout, /[1-9]\d* (?:failed|skipped)/);

  async function apiRequest(route, options = {}) {
    const response = await fetch(`${apiOrigin}${route}`, {
      ...options,
      headers: {
        Origin: webOrigin,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.data.accessToken}`,
      },
      signal: AbortSignal.timeout(10_000),
    });
    assert.ok(response.ok, `${route} returned ${response.status}`);

    return response.json();
  }
  async function eventually(label, check) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (await check()) return;

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.fail(label);
  }
  // Page through the same public contract used by clients; do not hardcode seeded IDs.
  const nodes = [];
  let cursor;
  do {
    const page = await apiRequest(
      `/v1/tree?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    );
    nodes.push(...page.items);
    cursor = page.pageInfo.nextCursor;
  } while (cursor);
  const list = nodes.find((node) => node.type === 'list' && node.name === 'Product backlog');
  assert.ok(list);
  const statuses = await apiRequest(`/v1/lists/${list.id}/resolved-statuses`);
  const initialStatus = statuses.items.find((status) => status.category === 'not_started');
  const activeStatus = statuses.items.find((status) => status.category === 'active');
  let task = await apiRequest(`/v1/lists/${list.id}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'Docker persistence check',
      statusId: initialStatus.id,
      customFields: { effort: 1 },
      expectedConfigVersion: statuses.configVersion,
    }),
  });
  const patch = async (changes) =>
    apiRequest(`/v1/tasks/${task.data.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...changes,
        expectedVersion: task.data.version,
        expectedConfigVersion: task.configVersion,
      }),
    });
  task = await patch({ title: 'Preserve this API edit', customFields: { effort: 2 } });
  const imageIds = await Promise.all(
    ['api', 'web', 'worker'].map((service) => run('images', '-q', service)),
  );
  const containerIds = await Promise.all(
    ['api', 'web', 'worker'].map((service) => run('ps', '-q', service)),
  );
  await run('exec', '-T', 'redis', 'redis-cli', 'SET', 'delivery-probe', 'retained');
  await run('stop', 'web', 'worker', 'api');
  const shutdownLogs = await run('logs', '--no-color', '--no-log-prefix', 'api', 'worker');
  const events = new Set(
    [...shutdownLogs.matchAll(/"event":"([\w.-]+)"/g)].map((match) => match[1]),
  );
  assert.ok(
    events.has('api.stopped'),
    `API shutdown event missing; events: ${[...events].join(', ')}`,
  );
  assert.ok(
    events.has('worker.stopped'),
    `Worker shutdown event missing; events: ${[...events].join(', ')}`,
  );
  await run('restart', 'postgres', 'redis');
  await run('up', '--no-build', '--no-recreate', '--detach', '--wait', '--wait-timeout', '180');
  assert.deepEqual(
    await Promise.all(['api', 'web', 'worker'].map((service) => run('images', '-q', service))),
    imageIds,
    'Restart must reuse the built images',
  );
  assert.deepEqual(
    await Promise.all(['api', 'web', 'worker'].map((service) => run('ps', '-q', service))),
    containerIds,
    'Restart must preserve the existing containers',
  );
  task = await apiRequest(`/v1/tasks/${task.data.id}`);
  assert.equal(task.data.title, 'Preserve this API edit');
  assert.equal(task.data.customFields.effort, 2);
  assert.equal(await run('exec', '-T', 'redis', 'redis-cli', 'GET', 'delivery-probe'), 'retained');
  const psql = ['exec', '-T', 'postgres', 'psql', '-U', 'flowboard', '-d', 'flowboard', '-tAc'];
  assert.equal(await run(...psql, 'SELECT count(*) FROM seed_states;'), '1');
  assert.equal(await run(...psql, 'SELECT count(*) FROM tasks;'), '28');

  console.info(`[${project}] Check dependency outage, durable write and recovery`);
  await run('stop', 'redis');
  const statusCode = async (route) =>
    (
      await fetch(`${apiOrigin}${route}`, {
        signal: AbortSignal.timeout(10_000),
      })
    ).status;
  const workerStatus = (route) =>
    run(
      'exec',
      '-T',
      'worker',
      'node',
      '-e',
      `fetch('http://localhost:3002${route}',{signal:AbortSignal.timeout(3000)}).then(r=>console.log(r.status))`,
    );
  await eventually(
    'API and worker must report Redis unavailability',
    async () =>
      (await statusCode('/health/ready')) === 503 &&
      (await workerStatus('/health/ready')) === '503',
  );
  assert.equal(await statusCode('/health/live'), 200);
  assert.equal(await workerStatus('/health/live'), '200');
  task = await patch({ statusId: activeStatus.id });
  const expectedVersion = task.data.version;
  await run('start', 'redis');
  await eventually(
    'API and worker must recover after Redis returns',
    async () =>
      (await statusCode('/health/ready')) === 200 &&
      (await workerStatus('/health/ready')) === '200',
  );
  await eventually('The durable status event must reach the activity feed', async () => {
    const activity = await apiRequest(`/v1/tasks/${task.data.id}/activity?limit=100`);

    return activity.items.some((entry) => entry.payload.taskVersion === expectedVersion);
  });
  console.info(`[${project}] All Docker acceptance checks passed`);
} finally {
  // The random project name isolates this run from the user's development stack.
  // Volumes are retained; this command never deletes database storage.
  await run('down', '--timeout', '15');
  await execute('docker', ['image', 'rm', ...images], { env }).catch(() => {});
  await rm(fixture, { force: true, recursive: true });
  console.info(`[${project}] Test containers removed; isolated volumes retained`);
}
