import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';

import { startTestApplication } from '../../../test/common/application.mjs';
import {
  AuthTestOrigin as origin,
  SignupFixture as signup,
} from '../../../test/common/auth-fixtures.mjs';

let fixture;
let app;
let infrastructure;
beforeAll(async () => {
  fixture = await startTestApplication({ auth: true });
  ({ app, infrastructure } = fixture);
});
afterAll(async () => {
  await fixture?.close();
});

test('identity storage outage fails closed without disclosing a URL', async () => {
  infrastructure.stopPostgres();
  const response = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .set('Origin', origin)
    .send({ email: signup.email, password: signup.password });
  expect(response.status).toBe(503);
  expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
  expect(JSON.stringify(response.body)).not.toMatch(/postgres|password|127\.0\.0\.1/);
});
