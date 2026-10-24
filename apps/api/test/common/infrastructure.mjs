import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

const postgresImage =
  'postgres:17-bookworm@sha256:858bb5e98eed02eb8cafbcdc007f9a65d1b613972028944a8ec2133ccaf80d27';
const redisImage =
  'redis:7-alpine@sha256:57e4255cc971b1c8d6f8a6ca283ac01bc3ecdd914273ef6bfaede87aaecd6541';
const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: 'pipe', timeout: 120_000 }).trim();

export async function startInfrastructure() {
  const postgres = `flowboard-api-pg-${randomUUID()}`;
  const redis = `flowboard-api-redis-${randomUUID()}`;
  const password = randomUUID();
  const names = [];
  const close = () => {
    for (const name of names) docker('rm', '--force', '--volumes', name);
  };
  const stop = (name) => {
    docker('stop', name);
    names.splice(names.indexOf(name), 1);
  };
  try {
    docker(
      'run',
      '--detach',
      '--rm',
      '--name',
      postgres,
      '--publish',
      '127.0.0.1::5432',
      '--env',
      `POSTGRES_PASSWORD=${password}`,
      '--env',
      'POSTGRES_DB=flowboard_api_test',
      postgresImage,
    );
    names.push(postgres);
    docker('run', '--detach', '--rm', '--name', redis, '--publish', '127.0.0.1::6379', redisImage);
    names.push(redis);
    for (let attempt = 0; ; attempt += 1) {
      try {
        docker('exec', postgres, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres');
        docker('exec', redis, 'redis-cli', 'ping');
        break;
      } catch {
        if (attempt >= 100) throw new Error('Test dependencies did not become ready');

        await setTimeout(100);
      }
    }

    return {
      names: [...names],
      close,
      databaseUrl: `postgresql://postgres:${password}@${docker('port', postgres, '5432/tcp')}/flowboard_api_test`,
      redisUrl: `redis://${docker('port', redis, '6379/tcp')}`,
      pauseRedis: () => docker('exec', redis, 'redis-cli', 'CLIENT', 'PAUSE', '4000', 'ALL'),
      stopPostgres: () => stop(postgres),
      stopRedis: () => stop(redis),
    };
  } catch (error) {
    close();
    throw error;
  }
}
