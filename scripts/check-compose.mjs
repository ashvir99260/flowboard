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
  const api = await fetch(`http://${apiAddress}/v1/tasks`, {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(api.status, 404, 'The shell must not claim a domain API exists');

  console.info(`[${project}] Verify persistent PostgreSQL and Redis data across restart`);
  const psql = ['exec', '-T', 'postgres', 'psql', '-U', 'flowboard', '-d', 'flowboard', '-tAc'];
  await run(
    ...psql,
    "CREATE TABLE delivery_probe(value text); INSERT INTO delivery_probe VALUES ('retained');",
  );
  await run('exec', '-T', 'redis', 'redis-cli', 'SET', 'delivery-probe', 'retained');
  await run('restart', 'postgres', 'redis', 'api', 'worker', 'web');
  await run('up', '--detach', '--wait', '--wait-timeout', '180');
  assert.equal(await run(...psql, 'SELECT value FROM delivery_probe;'), 'retained');
  assert.equal(await run('exec', '-T', 'redis', 'redis-cli', 'GET', 'delivery-probe'), 'retained');
  const restartedAddress = await run('port', 'web', '3000');
  const restarted = await fetch(`http://${restartedAddress}`, {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(restarted.status, 200);
  console.info(`[${project}] All Docker acceptance checks passed`);
} finally {
  // The random project name isolates this run from the user's development stack.
  // Volumes are retained; this command never deletes database storage.
  await run('down', '--timeout', '15');
  console.info(`[${project}] Test containers removed; isolated volumes retained`);
}
