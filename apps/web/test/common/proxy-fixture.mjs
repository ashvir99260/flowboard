import { once } from 'node:events';
import { createServer } from 'node:http';
import { createServer as reserveServer } from 'node:net';

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

export async function startWeb(t, api, hostname = 'localhost') {
  const reserve = reserveServer();
  reserve.listen(0, 'localhost');
  await once(reserve, 'listening');
  const { port } = reserve.address();
  await new Promise((resolve, reject) =>
    reserve.close((error) => (error ? reject(error) : resolve())),
  );
  const origin = `http://${hostname}:${port}`;
  const runtime = startProcess(['.next/standalone/apps/web/server.js'], {
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
  t.after(() => runtime.stop(null, 143));
  await runtime.waitFor(/Ready in/);

  return { origin, runtime };
}
