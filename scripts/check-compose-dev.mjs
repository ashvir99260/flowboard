import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = await mkdtemp(path.join(tmpdir(), 'flowboard-dev-check-'));
const project = `flowboard-dev-check-${randomUUID().slice(0, 8)}`;
const control = process.argv.includes('--production-control');
const env = {
  ...process.env,
  WEB_PORT: '0',
  API_PORT: '0',
  POSTGRES_PORT: '0',
  REDIS_PORT: '0',
  POSTGRES_USER: 'flowboard',
  POSTGRES_PASSWORD: 'flowboard-dev-check-only',
  POSTGRES_DB: 'flowboard',
  AUTH_SECRET: 'flowboard-dev-check-secret-abcdefghijklmnopqrstuvwxyz',
  AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
  WEB_ALLOWED_ORIGINS: 'http://localhost:3000',
  AUTH_ALLOW_INSECURE_HTTP: 'true',
  DEMO_SEED: 'true',
  API_DOCS: 'true',
};
const prefix = ['compose', '--project-name', project, '-f', 'compose.yaml'];
if (!control) prefix.push('-f', 'compose.dev.yaml');

async function docker(...args) {
  const operation = execute('docker', [...prefix, ...args], {
    cwd: fixture,
    env,
    maxBuffer: 16 * 1024 * 1024,
    timeout: 900_000,
  });
  if (args.includes('--build')) {
    operation.child.stdout.on('data', (chunk) => process.stdout.write(chunk));
    operation.child.stderr.on('data', (chunk) => process.stdout.write(chunk));
  }

  const { stdout } = await operation;

  return stdout.trim();
}

async function edit(relative, before, after) {
  const target = path.join(fixture, relative);
  const content = await readFile(target, 'utf8');
  assert.ok(content.includes(before), `Probe anchor missing: ${relative}`);
  await writeFile(target, content.replace(before, after));
}

async function eventually(label, check) {
  const deadline = Date.now() + (control ? 15_000 : 90_000);
  while (Date.now() < deadline) {
    if (await check()) return;

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.fail(`Saved change was not observed: ${label}`);
}

async function body(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });

    return response.ok ? await response.text() : '';
  } catch {
    return '';
  }
}

async function probeHeader(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    await response.text();

    return response.headers.get('x-development-probe');
  } catch {
    return null;
  }
}

async function probePort(service, port, request, expected) {
  const address = await docker('port', service, String(port));
  const [host, published] = address.split(':');
  assert.equal(host, '127.0.0.1');
  await new Promise((resolve, reject) => {
    const socket = createConnection({ host: 'localhost', port: Number(published) });
    let response = '';
    socket.setTimeout(3000, () => socket.destroy(new Error(`${service} probe timed out`)));
    socket.once('error', reject);
    socket.once('close', () => reject(new Error(`${service} closed before the expected reply`)));
    socket.once('connect', () => socket.write(request));
    socket.on('data', (data) => {
      response += data.toString();
      if (response.length < expected.length) return;

      try {
        assert.equal(response, expected);
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        socket.destroy();
      }
    });
  });
}

async function runtimeState() {
  return Promise.all(
    ['web', 'api', 'worker'].map(async (service) => {
      const id = await docker('ps', '--all', '-q', service);
      const { stdout } = await execute('docker', [
        'inspect',
        '--format',
        '{{.State.Health.Status}} {{.RestartCount}}',
        id,
      ]);
      const [health, restarts] = stdout.trim().split(' ');

      return { service, health, restarts };
    }),
  );
}

try {
  const excluded = new Set([
    '.git',
    'node_modules',
    '.pnpm-store',
    '.next',
    'dist',
    'out',
    '.turbo',
    '.ai-local',
    '.serena',
    'graphify-out',
  ]);
  await cp(root, fixture, {
    recursive: true,
    filter(source) {
      const relative = path.relative(root, source);
      const parts = relative.split(path.sep);

      return (
        !parts.some((part) => excluded.has(part) || part.startsWith('.env')) &&
        !relative.startsWith('packages/database/src/generated')
      );
    },
  });
  // The read-only parent needs this empty mount point before Docker overlays tmpfs.
  const generated = path.join(fixture, 'packages/database/src/generated');
  await mkdir(generated);
  await writeFile(
    path.join(fixture, 'compose.probe.yaml'),
    JSON.stringify({
      services: Object.fromEntries(
        ['web', 'api', 'worker'].map((service) => [service, { image: `${project}-${service}` }]),
      ),
    }),
  );
  prefix.push('-f', 'compose.probe.yaml');
  if (!control) {
    const { services } = JSON.parse(await docker('config', '--format', 'json'));
    for (const [service, target] of [
      ['postgres', 5432],
      ['redis', 6379],
    ]) {
      assert.equal(
        services[service].ports?.length,
        1,
        `${service} must publish a development port`,
      );
      assert.equal(services[service].ports[0].host_ip, '127.0.0.1');
      assert.equal(services[service].ports[0].published, '0');
      assert.equal(services[service].ports[0].target, target);
    }
    for (const service of ['web', 'api', 'worker']) {
      assert.equal(services[service].build.target, 'development');
      assert.equal(services[service].restart, 'on-failure');
      assert.ok(services[service].volumes.length > 0);
      for (const mount of services[service].volumes) {
        assert.equal(mount.type, 'bind');
        assert.equal(mount.read_only, true);
        assert.ok(!/node_modules|\.env(?:\.|$)/.test(mount.source));
        assert.notEqual(mount.source, fixture);
      }
    }
  }

  // Probe-only UI exports live in the disposable copy, never in the user's checkout.
  await edit(
    'packages/ui/src/index.ts',
    'export {};',
    "export const DevelopmentProbe = 'dev-ui-before';",
  );
  await edit(
    'apps/web/app/page.tsx',
    'export default function',
    "import { DevelopmentProbe } from '@flowboard/ui';\n\nexport default function",
  );
  await edit(
    'apps/web/app/page.tsx',
    '<h1>Flowboard</h1>',
    '<h1>Flowboard</h1><p>{DevelopmentProbe}</p>',
  );
  console.info(
    `[${project}] Build and start isolated ${control ? 'production control' : 'development'} services`,
  );
  await docker('up', '--build', '-d', '--wait', '--wait-timeout', '180');
  if (!control) {
    const sslRequest = Buffer.alloc(8);
    sslRequest.writeInt32BE(8);
    sslRequest.writeInt32BE(80877103, 4);
    await probePort('postgres', 5432, sslRequest, 'N');
    await probePort('redis', 6379, '*1\r\n$4\r\nPING\r\n', '+PONG\r\n');
    console.info(`[${project}] Localhost PostgreSQL and Redis protocol probes passed`);
  }

  const web = `http://${await docker('port', 'web', '3000')}`;
  const api = `http://${await docker('port', 'api', '3001')}`;
  const containers = await docker('ps', '-q');
  if (!control) {
    for (const service of ['api', 'worker']) {
      await docker(
        'exec',
        '-T',
        service,
        'node',
        '--input-type=module',
        '-e',
        "import assert from 'node:assert/strict'; import { existsSync } from 'node:fs'; assert.equal(existsSync('/prod'), false, 'Development images must not duplicate production dependencies');",
      );
    }
  }

  assert.ok((await body(web)).includes('dev-ui-before'));
  await edit(
    'apps/web/app/page.tsx',
    'Application foundation is ready.',
    'Saved web change is visible.',
  );
  await eventually('web source reload', async () =>
    (await body(web)).includes('Saved web change is visible.'),
  );
  console.info(`[${project}] Web source reload passed`);
  await edit(
    'apps/web/src/server/api-proxy.ts',
    'Request origin is not allowed',
    'Development proxy reloaded',
  );
  await eventually('web server proxy reload', async () => {
    try {
      const response = await fetch(`${web}/api/v1/auth/login`, {
        method: 'POST',
        signal: AbortSignal.timeout(3000),
      });

      return (
        response.status === 403 && (await response.text()).includes('Development proxy reloaded')
      );
    } catch {
      return false;
    }
  });
  console.info(`[${project}] Web proxy source reload passed`);

  await edit('packages/ui/src/index.ts', 'dev-ui-before', 'dev-ui-after');
  await eventually('shared UI rebuild', async () => (await body(web)).includes('dev-ui-after'));
  await edit(
    'apps/api/src/modules/platform/health.controller.ts',
    'Controller, Get, Inject',
    'Controller, Get, Header, Inject',
  );
  await edit(
    'apps/api/src/modules/platform/health.controller.ts',
    "@Get('live')",
    "@Get('live')\n  @Header('X-Development-Probe', 'api-reloaded')",
  );
  await eventually(
    'API source reload',
    async () => (await probeHeader(`${api}/health/live`)) === 'api-reloaded',
  );
  await edit('apps/worker/src/main.ts', "'worker.started'", "'worker.dev-reloaded'");
  await eventually('worker source reload', async () =>
    (await docker('logs', '--no-color', 'worker')).includes('"event":"worker.dev-reloaded"'),
  );
  console.info(`[${project}] Shared UI, API and worker source reload passed`);

  await edit(
    'packages/logger/src/index.ts',
    '          event,',
    '          event: `${event}.dev-shared`,',
  );
  await eventually('shared logger reaches API and worker', async () => {
    const logs = await docker('logs', '--no-color', 'api', 'worker');

    return (
      logs.includes('"event":"api.started.dev-shared"') &&
      logs.includes('"event":"worker.dev-reloaded.dev-shared"')
    );
  });
  const controller = path.join(fixture, 'apps/api/src/modules/platform/health.controller.ts');
  const validController = await readFile(controller, 'utf8');
  const previousLogs = await docker('logs', '--no-color', 'api');
  await writeFile(controller, `invalid TypeScript syntax;\n${validController}`);
  await eventually('invalid code is diagnosed', async () =>
    /error TS\d+/.test((await docker('logs', '--no-color', 'api')).slice(previousLogs.length)),
  );
  await writeFile(controller, validController.replace('api-reloaded', 'api-recovered'));
  await eventually(
    'API recovers after correction',
    async () => (await probeHeader(`${api}/health/live`)) === 'api-recovered',
  );
  await eventually('web remains live after shared rebuilds', async () =>
    (await body(web)).includes('dev-ui-after'),
  );
  assert.equal(await body(`${api}/health/ready`), '{"status":"ready"}');

  for (const service of ['web', 'api', 'worker']) {
    assert.notEqual(await docker('exec', '-T', service, 'node', '-p', 'process.getuid()'), '0');
    await docker(
      'exec',
      '-T',
      service,
      'node',
      '--input-type=module',
      '-e',
      "import assert from 'node:assert/strict'; import { existsSync } from 'node:fs'; for (const file of ['.env', 'apps/api/.env', 'apps/worker/.env', 'apps/web/.env.local']) assert.equal(existsSync(file), false);",
    );
  }
  assert.equal(
    await docker(
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'flowboard',
      '-d',
      'flowboard',
      '-tAc',
      'SELECT count(*) FROM tasks;',
    ),
    '27',
  );
  assert.equal(await docker('ps', '-q'), containers, 'Source updates must not replace containers');
  assert.deepEqual(await readdir(generated), [], 'Generated Prisma files must stay in containers');
  await eventually('all development services recover health', async () =>
    (await runtimeState()).every(({ health }) => health === 'healthy'),
  );
  const stable = await runtimeState();
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  assert.deepEqual(
    await runtimeState(),
    stable,
    'Idle services must remain healthy without restart loops',
  );
  console.info(
    `[${project}] All live-edit, recovery, isolation and data-preservation checks passed`,
  );
} catch (error) {
  console.error(
    await docker('logs', '--no-color', '--tail', '60', 'postgres', 'redis', 'api', 'worker', 'web'),
  );
  throw error;
} finally {
  try {
    await docker('down', '--timeout', '15');
    const { stdout } = await execute('docker', [
      'image',
      'ls',
      '--format',
      '{{.Repository}}:{{.Tag}}',
      '--filter',
      `reference=${project}-*`,
    ]);
    if (stdout.trim()) await execute('docker', ['image', 'rm', ...stdout.trim().split('\n')]);
  } finally {
    await rm(fixture, { force: true, recursive: true });
  }
  console.info(
    `[${project}] Test containers/images/source copy removed; isolated data volumes retained`,
  );
}
