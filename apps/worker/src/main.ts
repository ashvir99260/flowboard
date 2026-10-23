import { createServer } from 'node:net';

const port = Number(process.env.PORT ?? 3002);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('PORT must be an integer between 0 and 65535');
  process.exitCode = 1;
} else {
  // TODO(P11-02): Replace process-only liveness with the real BullMQ worker lifecycle.
  const server = createServer((socket) => socket.end(() => socket.destroy()));
  server.on('error', (error: Error) => {
    console.error(`Worker startup failed: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, process.env.HOST ?? '127.0.0.1', () => {
    const address = server.address();
    if (address && typeof address !== 'string') {
      console.info('[worker] Queue processing is not implemented (P11-02).');
      console.info(`[worker] Process listening on port ${address.port}`);
    }
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => server.close());
  }
}
