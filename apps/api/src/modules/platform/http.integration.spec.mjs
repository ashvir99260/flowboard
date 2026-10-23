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
