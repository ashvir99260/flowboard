import { once } from 'node:events';
import { createConnection } from 'node:net';

import { expect, jest, test } from '@jest/globals';

import { createApplication } from '../../../dist/application.js';

test('application closes each injected runtime once after module composition', async () => {
  const closeProbe = jest.fn(async () => {});
  const closeAuth = jest.fn(async () => {});
  const closeDatabase = jest.fn(async () => {});
  const { app } = await createApplication(
    { async check() {}, close: closeProbe },
    {
      auth: { settings: { allowedOrigins: [] }, close: closeAuth },
      database: { close: closeDatabase },
    },
  );
  try {
    await app.init();
    expect(closeProbe).not.toHaveBeenCalled();
    expect(closeAuth).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
  expect(closeProbe).toHaveBeenCalledTimes(1);
  expect(closeAuth).toHaveBeenCalledTimes(1);
  expect(closeDatabase).toHaveBeenCalledTimes(1);
});

test('application shutdown closes incomplete HTTP connections', async () => {
  const { app } = await createApplication({ async check() {}, async close() {} });
  await app.listen(0, 'localhost');
  const server = app.getHttpServer();
  const accepted = once(server, 'connection');
  const socket = createConnection({ host: 'localhost', port: server.address().port });
  const [, [serverSocket]] = await Promise.all([once(socket, 'connect'), accepted]);
  const received = once(serverSocket, 'data');
  socket.write('GET /health/live HTTP/1.1\r\nHost: localhost\r\n');
  await received;
  const closing = app.close();
  let timer;
  try {
    await Promise.race([
      closing,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Shutdown waited for partial HTTP headers')),
          6500,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
    socket.destroy();
    await closing;
  }
}, 10000);

test('application shutdown lets an active HTTP response finish before closing dependencies', async () => {
  const close = jest.fn(async () => {});
  const { app } = await createApplication({ async check() {}, close });
  const started = Promise.withResolvers();
  const release = Promise.withResolvers();
  app.use('/shutdown-probe', async (_request, response) => {
    started.resolve();
    await release.promise;
    response.end('finished');
  });
  await app.listen(0, 'localhost');
  const response = fetch(`http://localhost:${app.getHttpServer().address().port}/shutdown-probe`);
  await started.promise;
  const closing = app.close();
  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(close).not.toHaveBeenCalled();
    release.resolve();
    expect(await (await response).text()).toBe('finished');
    await closing;
    expect(close).toHaveBeenCalledTimes(1);
  } finally {
    release.resolve();
    await closing;
  }
});
