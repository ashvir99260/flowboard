import { once } from 'node:events';
import { createServer } from 'node:http';
import { createServer as reserveServer } from 'node:net';
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

export async function startWeb(t, api, hostname = 'localhost', development = false) {
  const reserve = reserveServer();
  reserve.listen(0, 'localhost');
  await once(reserve, 'listening');
  const { port } = reserve.address();
  await new Promise((resolve, reject) =>
    reserve.close((error) => (error ? reject(error) : resolve())),
  );
  const origin = `http://${hostname}:${port}`;
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
    cwd: new URL('../../', import.meta.url),
    outboundOrigins: [api],
    env: {
      API_INTERNAL_URL: api,
      WEB_ALLOWED_ORIGINS: origin,
      NEXT_TELEMETRY_DISABLED: '1',
      HOSTNAME: 'localhost',
      PORT: String(port),
    },
  });
  t.after(() => runtime.stop(null, development ? 0 : 143));
  await runtime.waitFor(/Ready in/);

  return { origin, runtime };
}
