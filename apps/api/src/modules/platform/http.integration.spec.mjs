import { ErrorEnvelopeSchema } from '@flowboard/contracts';
import { afterAll, beforeAll, expect, jest, test } from '@jest/globals';
import { ExpressAdapter } from '@nestjs/platform-express';
import request from 'supertest';

import { createApplication } from '../../../dist/application.js';
import { HealthController } from '../../../dist/modules/platform/health.controller.js';

let app;
beforeAll(async () => {
  ({ app } = await createApplication({ async check() {}, async close() {} }));
  await app.init();
});
afterAll(async () => {
  await app?.close();
});

test('the HTTP application uses the Express adapter', () => {
  expect(app.getHttpAdapter()).toBeInstanceOf(ExpressAdapter);
  expect(app.getHttpAdapter().getType()).toBe('express');
});

test('invalid server output fails with a sanitized 500', async () => {
  const { app: invalidApp } = await createApplication({ async check() {}, async close() {} });
  const controller = invalidApp.get(HealthController);
  const original = controller.getLiveness;
  const replacement = jest
    .spyOn(controller, 'getLiveness')
    .mockReturnValue({ passwordHash: 'never-leak', status: 'ok' });
  // Preserve handler metadata while injecting an invalid service result.
  for (const key of Reflect.getMetadataKeys(original)) {
    Reflect.defineMetadata(key, Reflect.getMetadata(key, original), replacement);
  }
  try {
    await invalidApp.init();
    const response = await request(invalidApp.getHttpServer()).get('/health/live');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    });
    expect(JSON.stringify(response.body)).not.toContain('never-leak');
  } finally {
    await invalidApp.close();
  }
});

test('parser failures are bounded, typed and retain request IDs', async () => {
  for (const [body, status, code] of [
    ['{"broken":', 400, 'VALIDATION_FAILED'],
    [JSON.stringify({ value: 'x'.repeat(270_000) }), 413, 'PAYLOAD_TOO_LARGE'],
  ]) {
    const response = await request(app.getHttpServer())
      .post('/v1/missing')
      .set('Content-Type', 'application/json')
      .send(body);
    expect(response.status).toBe(status);
    expect(ErrorEnvelopeSchema.parse(response.body).error.code).toBe(code);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  }
});

test('Swagger UI is opt-in for runtime and absent in spec bootstrap', async () => {
  expect((await request(app.getHttpServer()).get('/docs')).status).toBe(404);
  expect((await request(app.getHttpServer()).get('/docs-json')).status).toBe(404);
  expect((await request(app.getHttpServer()).get('/docs-yaml')).status).toBe(404);
  const { app: docsApp } = await createApplication(
    { async check() {}, async close() {} },
    { exposeDocs: true },
  );
  try {
    await docsApp.init();
    expect((await request(docsApp.getHttpServer()).get('/docs/')).status).toBe(200);
    const spec = await request(docsApp.getHttpServer()).get('/docs-json');
    expect(spec.body.servers).toEqual([{ url: '/' }]);
  } finally {
    await docsApp.close();
  }
});

test('hosted Swagger uses the public proxy without changing the canonical document', async () => {
  const { app: docsApp, document } = await createApplication(
    { async check() {}, async close() {} },
    { docsBasePath: '/api', exposeDocs: true },
  );
  try {
    await docsApp.init();
    const server = docsApp.getHttpServer();
    const spec = await request(server).get('/docs-json').set('Host', 'untrusted.example');
    expect(spec.status).toBe(200);
    expect(spec.body.servers).toEqual([{ url: '/api' }]);
    for (const path of ['/health/live', '/health/ready']) {
      expect(spec.body.paths[path].servers).toEqual([{ url: '/' }]);
    }
    expect(document.servers ?? []).toEqual([]);
    expect(document.paths['/health/live'].servers).toBeUndefined();
    expect((await request(server).get('/docs')).status).toBe(200);
    expect((await request(server).get('/docs/')).status).toBe(200);
    expect((await request(server).get('/docs-yaml')).status).toBe(200);
    expect((await request(server).get('/docs/swagger-ui.css')).status).toBe(200);
    const init = await request(server).get('/docs/swagger-ui-init.js');
    expect(init.status).toBe(200);
    expect(init.text).toMatch(/"withCredentials"\s*:\s*true/);
    expect(init.text).toMatch(/"persistAuthorization"\s*:\s*false/);
  } finally {
    await docsApp.close();
  }
});
