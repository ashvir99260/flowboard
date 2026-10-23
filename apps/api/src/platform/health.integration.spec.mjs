import { ErrorEnvelopeSchema } from '@flowboard/contracts';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';

import { startTestApplication } from '../../test/common/application.mjs';

let fixture;
let app;
let infrastructure;
beforeAll(async () => {
  fixture = await startTestApplication();
  ({ app, infrastructure } = fixture);
});
afterAll(async () => {
  await fixture?.close();
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
