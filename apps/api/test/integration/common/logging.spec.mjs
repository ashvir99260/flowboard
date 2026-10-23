import { createLogger } from '@flowboard/logger';
import { expect, test } from '@jest/globals';
import request from 'supertest';

import { createApplication } from '../../../dist/application.js';

const probe = { async check() {}, async close() {} };

test('request logs correlate concurrent responses, ignore supplied IDs, and exclude secret channels', async () => {
  const records = [];
  const logger = createLogger({
    service: 'api',
    level: 'debug',
    write: (line) => records.push(JSON.parse(line)),
  });
  const { app } = await createApplication(probe, { logger });
  try {
    await app.init();
    const responses = await Promise.all([
      request(app.getHttpServer())
        .get('/health/live')
        .set('Authorization', 'Bearer secret-authorization')
        .set('Cookie', 'secret-cookie')
        .set('X-Request-Id', 'secret-id'),
      request(app.getHttpServer())
        .post('/v1/secret-path?key=secret-key')
        .send({ password: 'secret-password' }),
      request(app.getHttpServer())
        .post('/v1/secret-parse')
        .set('Content-Type', 'application/json')
        .send('{"secret-body":'),
    ]);
    const completed = records.filter(({ event }) => event === 'http.completed');
    expect(completed).toHaveLength(3);
    expect(new Set(completed.map(({ requestId }) => requestId)).size).toBe(3);
    for (const response of responses)
      expect(
        completed.some(({ requestId }) => requestId === response.headers['x-request-id']),
      ).toBe(true);
    expect(completed.map(({ statusCode }) => statusCode).sort()).toEqual([200, 400, 404]);
    expect(completed.find(({ statusCode }) => statusCode === 200).level).toBe('debug');
    expect(completed.find(({ statusCode }) => statusCode === 404).route).toBe('unmatched');
    expect(
      records.some(({ event, code }) => event === 'http.error' && code === 'VALIDATION_FAILED'),
    ).toBe(true);
    expect(JSON.stringify(records)).not.toMatch(/secret-|password|authorization|cookie/i);
  } finally {
    await app.close();
  }
});

test('a broken log writer does not break the HTTP response', async () => {
  const logger = createLogger({
    service: 'api',
    level: 'trace',
    write: () => {
      throw new Error('sink failed');
    },
  });
  const { app } = await createApplication(probe, { logger });
  try {
    await app.init();
    expect((await request(app.getHttpServer()).get('/health/live')).status).toBe(200);
  } finally {
    await app.close();
  }
});
