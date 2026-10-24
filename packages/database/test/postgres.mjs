import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

import pg from 'pg';

const image =
  'postgres:17-bookworm@sha256:858bb5e98eed02eb8cafbcdc007f9a65d1b613972028944a8ec2133ccaf80d27';

// A task-owned container, random host port and fresh database on every run.
// Never read DATABASE_URL here: tests must not touch development or hosted data.
export async function startPostgres() {
  const name = `flowboard-test-${randomUUID()}`;
  const password = randomUUID();
  execFileSync(
    'docker',
    [
      'run',
      '--detach',
      '--rm',
      '--name',
      name,
      '--publish',
      '127.0.0.1::5432',
      '--env',
      `POSTGRES_PASSWORD=${password}`,
      '--env',
      'POSTGRES_DB=flowboard_test',
      image,
    ],
    { stdio: 'pipe' },
  );
  const stop = () =>
    execFileSync('docker', ['rm', '--force', '--volumes', name], { stdio: 'pipe' });
  const connectionUrl = () => {
    const mapping = execFileSync('docker', ['port', name, '5432/tcp'], { encoding: 'utf8' }).trim();

    return `postgresql://postgres:${password}@${mapping}/flowboard_test`;
  };
  try {
    const connectionString = connectionUrl();
    const database = {
      client: await connect(connectionString),
      connectionString,
      name,
      async restart() {
        await database.client.end();
        execFileSync('docker', ['restart', name], { stdio: 'pipe' });
        // Docker can allocate a different ephemeral published port on restart.
        database.connectionString = connectionUrl();
        database.client = await connect(database.connectionString);
      },
      stop,
    };

    return database;
  } catch (error) {
    stop();
    throw error;
  }
}

async function connect(connectionString) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const client = new pg.Client({ connectionString });
    try {
      await client.connect();

      return client;
    } catch {
      await client.end();
      await setTimeout(100);
    }
  }
  throw new Error('Isolated PostgreSQL did not become ready');
}

export function migrate(connectionString) {
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
      DATABASE_URL_UNPOOLED: connectionString,
    },
    stdio: 'pipe',
  });
}

export async function applicationUrl(database) {
  const role = `flowboard_app_${randomUUID().replaceAll('-', '')}`;
  const password = randomUUID();
  // Both identifiers are generated locally, never supplied by callers.
  await database.client.query(
    `CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`,
  );
  await database.client.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
  const tables = [
    'users',
    'workspaces',
    'memberships',
    'refresh_sessions',
    'invitations',
    'nodes',
    'grants',
    'status_identities',
    'status_overrides',
    'field_definitions',
    'tasks',
    'task_assignees',
    'outbox_events',
    'activities',
    'seed_states',
  ]
    .map((name) => `"${name}"`)
    .join(', ');
  await database.client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${tables} TO "${role}"`);
  const url = new URL(database.connectionString);
  url.username = role;
  url.password = password;

  return url.toString();
}
