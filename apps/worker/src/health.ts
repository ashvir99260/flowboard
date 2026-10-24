import { createServer } from 'node:http';

export function createHealthServer(runtime: { healthy(): Promise<boolean> }) {
  return createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    if (
      request.method !== 'GET' ||
      !['/health/live', '/health/ready'].includes(request.url ?? '')
    ) {
      response.writeHead(404).end(JSON.stringify({ status: 'not_found' }));

      return;
    }

    void (async () => {
      const healthy = request.url === '/health/live' || (await runtime.healthy());
      response
        .writeHead(healthy ? 200 : 503)
        .end(JSON.stringify({ status: healthy ? 'ok' : 'unavailable' }));
    })().catch(() => response.writeHead(503).end(JSON.stringify({ status: 'unavailable' })));
  });
}
