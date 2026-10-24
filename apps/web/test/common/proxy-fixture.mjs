import { once } from 'node:events';
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createServer as reserveServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startProcess } from '@flowboard/config-jest/process';

export async function startUpstream(t, handler) {
  const server = createServer(handler);
  server.listen(0, 'localhost');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();

    return new Promise((resolve) => server.close(resolve));
  });

  return `http://localhost:${server.address().port}`;
}

async function developmentCopy() {
  const source = fileURLToPath(new URL('../../', import.meta.url));
  const base = new URL('../../../../.ai-local/web-tests/', import.meta.url);
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(new URL('dev-', base));
  try {
    await cp(source, directory, {
      recursive: true,
      filter: (entry) => {
        const relative = path.relative(source, entry);

        return (
          !relative ||
          ['app', 'src', 'public', 'package.json', 'tsconfig.json'].includes(
            relative.split(path.sep)[0],
          )
        );
      },
    });
    await symlink(path.join(source, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
    await writeFile(
      path.join(directory, 'next.config.ts'),
      `export { default } from ${JSON.stringify(path.join(source, 'next.config.ts'))};\n`,
    );

    return directory;
  } catch (error) {
    await rm(directory, { force: true, recursive: true });

    throw error;
  }
}

export async function startWeb(t, api, hostname = 'localhost', development = false) {
  const reserve = reserveServer();
  reserve.listen(0, 'localhost');
  await once(reserve, 'listening');
  const { port } = reserve.address();
  await new Promise((resolve, reject) =>
    reserve.close((error) => (error ? reject(error) : resolve())),
  );
  const origin = `http://${hostname}:${port}`;
  const directory = development ? await developmentCopy() : undefined;

  const args = development
    ? [
        fileURLToPath(import.meta.resolve('next/dist/bin/next')),
        'dev',
        '--hostname',
        'localhost',
        '--port',
        String(port),
      ]
    : ['.next/standalone/apps/web/server.js'];
  const runtime = startProcess(args, {
    cwd: directory ?? new URL('../../', import.meta.url),
    outboundOrigins: [api],
    env: {
      API_INTERNAL_URL: api,
      WEB_ALLOWED_ORIGINS: origin,
      NEXT_TELEMETRY_DISABLED: '1',
      HOSTNAME: 'localhost',
      PORT: String(port),
    },
  });
  t.after(async () => {
    try {
      await runtime.stop(null, development ? 0 : 143);
    } finally {
      if (directory) await rm(directory, { force: true, recursive: true });
    }
  });
  await runtime.waitFor(/Ready in/);

  return { origin, runtime };
}
