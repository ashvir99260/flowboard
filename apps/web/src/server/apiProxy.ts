import 'server-only';

import type { ErrorCode } from '@flowboard/contracts';

const requestHeaders = ['accept', 'authorization', 'content-type', 'origin'];
const responseHeaders = ['content-type', 'retry-after', 'x-request-id'];
const bodyLimit = 256 * 1024;

class PayloadTooLargeError extends Error {}

async function readBody(request: Request) {
  if (Number(request.headers.get('content-length')) > bodyLimit) throw new PayloadTooLargeError();

  if (!request.body) return undefined;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const aborted = () => {
    void reader.cancel(request.signal.reason).catch(() => undefined);
  };
  request.signal.addEventListener('abort', aborted, { once: true });
  try {
    while (true) {
      request.signal.throwIfAborted();
      const part = await reader.read();
      request.signal.throwIfAborted();
      if (part.done) break;

      length += part.value.byteLength;
      if (length > bodyLimit) throw new PayloadTooLargeError();

      chunks.push(part.value);
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return body;
  } finally {
    request.signal.removeEventListener('abort', aborted);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function origin(value: string): string {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid origin configuration');

  return url.origin;
}

function failure(status: number, code: ErrorCode, message: string): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function forwardApi(request: Request): Promise<Response> {
  try {
    const api = origin(process.env.API_INTERNAL_URL ?? '');
    const allowed = (process.env.WEB_ALLOWED_ORIGINS ?? '')
      .split(',')
      .filter(Boolean)
      .map((value) => origin(value.trim()));
    if (!allowed.length) throw new Error('Web origins required');

    const suppliedOrigin = request.headers.get('origin');
    if (
      (suppliedOrigin && !allowed.includes(suppliedOrigin)) ||
      (!['GET', 'HEAD'].includes(request.method) && !suppliedOrigin)
    )
      return failure(403, 'ORIGIN_REJECTED', 'Request origin is not allowed');

    const incoming = new URL(request.url);
    if (!/^\/api\/v1(?:\/[A-Za-z0-9_-]+)+\/?$/.test(incoming.pathname))
      return failure(400, 'VALIDATION_FAILED', 'Invalid API path');

    const target = new URL(incoming.pathname.slice(4) + incoming.search, api);
    const headers = new Headers();
    for (const name of requestHeaders) {
      const value = request.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    const cookies = request.headers
      .get('cookie')
      ?.split(';')
      .map((part) => part.trim())
      .filter((part) => part.startsWith('flowboard_refresh='));
    if (cookies?.length) headers.set('cookie', cookies.join('; '));

    const body = await readBody(request);
    const upstream = await fetch(target, {
      body,
      cache: 'no-store',
      headers,
      method: request.method,
      redirect: 'manual',
      signal: request.signal,
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      await upstream.body?.cancel();

      return failure(503, 'SERVICE_UNAVAILABLE', 'API transport unavailable');
    }

    const resultHeaders = new Headers({ 'Cache-Control': 'no-store' });
    for (const cookie of upstream.headers.getSetCookie()) {
      if (cookie.startsWith('flowboard_refresh=')) resultHeaders.append('Set-Cookie', cookie);
    }
    for (const name of responseHeaders) {
      const value = upstream.headers.get(name);
      if (value !== null) resultHeaders.set(name, value);
    }

    return new Response(upstream.body, { headers: resultHeaders, status: upstream.status });
  } catch (error) {
    request.signal.throwIfAborted();
    if (error instanceof PayloadTooLargeError)
      return failure(413, 'PAYLOAD_TOO_LARGE', 'Request is too large');

    return failure(503, 'SERVICE_UNAVAILABLE', 'API transport unavailable');
  }
}
