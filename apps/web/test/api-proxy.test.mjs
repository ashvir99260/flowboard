import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';

import { forwardApi } from '../src/server/api-proxy.ts';

async function upstream(t, handler) {
  const server = createServer(handler);
  server.listen(0, 'localhost');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();

    return new Promise((resolve) => server.close(resolve));
  });

  return `http://localhost:${server.address().port}`;
}

function configure(t, api) {
  const oldApi = process.env.API_INTERNAL_URL;
  const oldWeb = process.env.WEB_ALLOWED_ORIGINS;
  process.env.API_INTERNAL_URL = api;
  process.env.WEB_ALLOWED_ORIGINS = 'https://web.example.test';
  t.after(() => {
    if (oldApi === undefined) delete process.env.API_INTERNAL_URL;
    else process.env.API_INTERNAL_URL = oldApi;

    if (oldWeb === undefined) delete process.env.WEB_ALLOWED_ORIGINS;
    else process.env.WEB_ALLOWED_ORIGINS = oldWeb;
  });
}

test('proxy forwards raw requests only to its fixed API origin and returns API errors', async (t) => {
  const calls = [];
  const api = await upstream(t, async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    calls.push({
      headers: request.headers,
      method: request.method,
      url: request.url,
      body: Buffer.concat(chunks).toString(),
    });
    response.writeHead(400, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public,max-age=3600',
      'Content-Type': 'application/json',
      'X-Request-Id': 'request-id',
    });
    response.end('{"error":{"code":"VALIDATION_FAILED","message":"Invalid input"}}');
  });
  configure(t, api);
  const response = await forwardApi(
    new Request('https://web.example.test/api/v1/tasks/task-id?a=1&a=2', {
      method: 'DELETE',
      body: '{"expectedVersion":2}',
      headers: {
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
        Cookie: 'other=private; flowboard_refresh=one; flowboard_refresh=two',
        Origin: 'https://web.example.test',
        'X-Api-Url': 'https://attacker.example',
        'X-Forwarded-For': 'attacker',
        'X-Forwarded-Host': 'attacker.example',
      },
    }),
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'VALIDATION_FAILED');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-request-id'), 'request-id');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'DELETE');
  assert.equal(calls[0].url, '/v1/tasks/task-id?a=1&a=2');
  assert.equal(calls[0].body, '{"expectedVersion":2}');
  assert.equal(calls[0].headers.authorization, 'Bearer access-token');
  assert.equal(calls[0].headers.origin, 'https://web.example.test');
  assert.equal(calls[0].headers.cookie, 'flowboard_refresh=one; flowboard_refresh=two');
  assert.equal(calls[0].headers['x-forwarded-for'], undefined);
  assert.equal(calls[0].headers['x-forwarded-host'], undefined);
  assert.equal(calls[0].headers['x-api-url'], undefined);
});

test('mutations require an explicit allowed original Origin before forwarding', async (t) => {
  let calls = 0;
  configure(
    t,
    await upstream(t, (_request, response) => {
      calls++;
      response.end('{}');
    }),
  );
  for (const origin of [
    undefined,
    'null',
    'https://attacker.example',
    'https://web.example.test.evil',
  ]) {
    const headers = origin ? { Origin: origin } : {};
    const response = await forwardApi(
      new Request('https://web.example.test/api/v1/auth/login', {
        method: 'POST',
        headers,
        body: '{}',
      }),
    );
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'ORIGIN_REJECTED');
  }
  assert.equal(calls, 0);
});

test('invalid runtime origins fail closed without disclosing configuration', async (t) => {
  configure(t, 'https://api.example.test');
  for (const value of [
    '',
    'file:///private/data',
    'https://user:secret@api.example.test',
    'https://api.example.test/path',
    'https://api.example.test?token=secret',
    'https://api.example.test#fragment',
  ]) {
    process.env.API_INTERNAL_URL = value;
    const response = await forwardApi(new Request('https://web.example.test/api/v1/tasks'));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: { code: 'SERVICE_UNAVAILABLE', message: 'API transport unavailable' },
    });
  }
});

test('ambiguous paths never reach upstream and redirects are not followed', async (t) => {
  let calls = 0;
  configure(
    t,
    await upstream(t, (_request, response) => {
      calls++;
      response.writeHead(302, { Location: '/redirected' });
      response.end();
    }),
  );
  for (const path of [
    '/api/v1/%2fadmin',
    '/api/v1/%5cadmin',
    '/api/v1/%252e%252e',
    '/api/v1//elsewhere',
    '/api/v1/../../admin',
    '/api/v1/tasks.json',
    '/other/v1/tasks',
  ]) {
    const response = await forwardApi(new Request(`https://web.example.test${path}`));
    assert.equal(response.status, 400, path);
  }
  assert.equal(calls, 0);
  const redirect = await forwardApi(new Request('https://web.example.test/api/v1/tasks'));
  assert.equal(redirect.status, 503);
  assert.equal(redirect.headers.get('location'), null);
  assert.equal(calls, 1);
});

test('refresh cookies remain separate and unrelated cookies and transport headers are removed', async (t) => {
  configure(
    t,
    await upstream(t, (_request, response) => {
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': [
          'unrelated=ignored; Path=/',
          'flowboard_refresh=first; Path=/; HttpOnly; SameSite=Lax; Expires=Fri, 25 Dec 2026 00:00:00 GMT; Secure',
          'flowboard_refresh=second; Path=/; HttpOnly; SameSite=Lax; Secure',
        ],
      });
      response.end('{}');
    }),
  );
  const response = await forwardApi(
    new Request('https://web.example.test/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Origin: 'https://web.example.test' },
    }),
  );
  assert.deepEqual(response.headers.getSetCookie(), [
    'flowboard_refresh=first; Path=/; HttpOnly; SameSite=Lax; Expires=Fri, 25 Dec 2026 00:00:00 GMT; Secure',
    'flowboard_refresh=second; Path=/; HttpOnly; SameSite=Lax; Secure',
  ]);
  assert.equal(response.headers.get('content-length'), null);
  assert.equal(response.headers.get('connection'), null);
});

test('oversized bodies are rejected before upstream writes', async (t) => {
  let calls = 0;
  configure(
    t,
    await upstream(t, (_request, response) => {
      calls++;
      response.end('{}');
    }),
  );
  const response = await forwardApi(
    new Request('https://web.example.test/api/v1/tasks', {
      method: 'POST',
      headers: { Origin: 'https://web.example.test' },
      body: 'x'.repeat(256 * 1024 + 1),
    }),
  );
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, 'PAYLOAD_TOO_LARGE');
  assert.equal(calls, 0);
});

test('abort does not wait for an uncooperative request stream to finish cancelling', async (t) => {
  configure(t, 'http://localhost:1');
  const abort = new AbortController();
  let started;
  const reading = new Promise((resolve) => {
    started = resolve;
  });
  const body = new globalThis.ReadableStream({
    pull() {
      started();
    },
    cancel() {
      return new Promise(() => {});
    },
  });
  const pending = forwardApi(
    new Request('https://web.example.test/api/v1/tasks', {
      method: 'POST',
      headers: { Origin: 'https://web.example.test' },
      body,
      signal: abort.signal,
      duplex: 'half',
    }),
  );
  await reading;
  abort.abort();
  let timer;
  const outcome = await Promise.race([
    pending.then(
      () => 'fulfilled',
      (error) => error.name,
    ),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve('timeout'), 500);
    }),
  ]);
  clearTimeout(timer);
  assert.equal(outcome, 'AbortError');
});

test('oversized request rejection does not wait for stalled stream cancellation', async (t) => {
  configure(t, 'http://localhost:1');
  const body = new globalThis.ReadableStream(
    {
      pull(controller) {
        controller.enqueue(new Uint8Array(256 * 1024 + 1));
      },
      cancel() {
        return new Promise(() => {});
      },
    },
    { highWaterMark: 0 },
  );
  const pending = forwardApi(
    new Request('https://web.example.test/api/v1/tasks', {
      method: 'POST',
      headers: { Origin: 'https://web.example.test' },
      body,
      duplex: 'half',
    }),
  );
  let timer;
  const outcome = await Promise.race([
    pending.then((response) => response.status),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve('timeout'), 500);
    }),
  ]);
  clearTimeout(timer);
  assert.equal(outcome, 413);
});

test('HEAD and no-content responses preserve status and empty bodies', async (t) => {
  configure(
    t,
    await upstream(t, (request, response) => {
      response.writeHead(request.method === 'HEAD' ? 200 : 204);
      response.end();
    }),
  );
  for (const [method, status] of [
    ['HEAD', 200],
    ['DELETE', 204],
  ]) {
    const response = await forwardApi(
      new Request('https://web.example.test/api/v1/tasks/task-id', {
        method,
        headers: { Origin: 'https://web.example.test' },
      }),
    );
    assert.equal(response.status, status);
    assert.equal(await response.text(), '');
  }
});

test('decoded upstream responses discard compressed transport metadata', async (t) => {
  const { gzipSync } = await import('node:zlib');
  const body = gzipSync('{"decoded":true}');
  configure(
    t,
    await upstream(t, (_request, response) => {
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
        'Content-Length': body.length,
      });
      response.end(body);
    }),
  );
  const response = await forwardApi(new Request('https://web.example.test/api/v1/tasks'));
  assert.deepEqual(await response.json(), { decoded: true });
  assert.equal(response.headers.get('content-encoding'), null);
  assert.equal(response.headers.get('content-length'), null);
});

test('abort stays attached after upstream headers arrive', async (t) => {
  configure(
    t,
    await upstream(t, (_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.write('{');
    }),
  );
  const abort = new AbortController();
  const response = await forwardApi(
    new Request('https://web.example.test/api/v1/tasks', { signal: abort.signal }),
  );
  const reading = response.text();
  abort.abort();
  await assert.rejects(reading, (error) => error.name === 'AbortError');
});
