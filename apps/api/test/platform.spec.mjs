import { ErrorEnvelopeSchema } from '@flowboard/contracts';
import { initializeDatabase } from '@flowboard/database';
import { afterAll, beforeAll, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import { createApplication } from '../dist/application.js';
import { runtimeProbe } from '../dist/platform/dependency-probe.js';
import { HealthController } from '../dist/platform/health.controller.js';
import { exportOpenApi } from '../dist/spec-bootstrap.js';

import { startInfrastructure } from './infrastructure.mjs';

let infrastructure;
let app;
beforeAll(async () => {
  infrastructure = await startInfrastructure();
  await initializeDatabase({ databaseUrl: infrastructure.databaseUrl });
  ({ app } = await createApplication(
    runtimeProbe(infrastructure.databaseUrl, infrastructure.redisUrl),
  ));
  await app.init();
});
afterAll(async () => {
  await app?.close();
  infrastructure?.close();
});

test('liveness and readiness are typed public responses backed by real dependencies', async () => {
  const live = await request(app.getHttpServer()).get('/health/live');
  expect(live.status).toBe(200);
  expect(live.body).toEqual({ status: 'ok' });
  expect(live.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  const ready = await request(app.getHttpServer()).get('/health/ready');
  expect(ready.status).toBe(200);
  expect(ready.body).toEqual({ status: 'ready' });
});

test('unknown query fields and routes return the shared error envelope', async () => {
  const invalid = await request(app.getHttpServer()).get('/health/live?role=admin');
  expect(invalid.status).toBe(400);
  expect(ErrorEnvelopeSchema.parse(invalid.body).error.code).toBe('VALIDATION_FAILED');
  const missing = await request(app.getHttpServer()).get('/v1/tasks');
  expect(missing.status).toBe(404);
  expect(missing.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
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

test('the spec-only bootstrap exposes real typed controller metadata without configuration', async () => {
  const document = await exportOpenApi();
  expect(Object.keys(document.paths).sort()).toEqual([
    '/health/live',
    '/health/ready',
    '/v1/auth/login',
    '/v1/auth/signup',
  ]);
  expect(document.paths['/health/live'].get.operationId).toBe('getLiveness');
  expect(document.paths['/health/ready'].get.operationId).toBe('getReadiness');
  expect(
    document.paths['/health/ready'].get.responses['503'].content['application/json'].schema,
  ).toBeDefined();
  expect(JSON.stringify(document)).not.toContain('passwordHash');
});

test('an established Redis connection that stops answering is bounded', async () => {
  infrastructure.pauseRedis();
  const start = Date.now();
  const response = await request(app.getHttpServer()).get('/health/ready');
  expect(response.status).toBe(503);
  expect(Date.now() - start).toBeLessThan(4500);
});

test('lost dependencies produce bounded 503 while liveness remains available', async () => {
  infrastructure.stopRedis();
  infrastructure.stopPostgres();
  const start = Date.now();
  const response = await request(app.getHttpServer()).get('/health/ready');
  expect(response.status).toBe(503);
  expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
  expect(Date.now() - start).toBeLessThan(5000);
  expect((await request(app.getHttpServer()).get('/health/live')).status).toBe(200);
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
  const { app: docsApp } = await createApplication(
    { async check() {}, async close() {} },
    { exposeDocs: true },
  );
  try {
    await docsApp.init();
    expect((await request(docsApp.getHttpServer()).get('/docs/')).status).toBe(200);
  } finally {
    await docsApp.close();
  }
});
