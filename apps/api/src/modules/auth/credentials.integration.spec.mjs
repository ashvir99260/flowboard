import { TextEncoder } from 'node:util';

import { createLogger } from '@flowboard/logger';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { SignJWT } from 'jose';
import request from 'supertest';

import { AppModule } from '../../../dist/app.module.js';
import { startTestApplication } from '../../../test/common/application.mjs';
import {
  AuthTestOrigin as origin,
  AuthTestSecret as secret,
  SignupFixture as signup,
} from '../../../test/common/auth-fixtures.mjs';
import { ProtectedController } from '../../../test/common/protected-controller.mjs';

const records = [];
const logger = createLogger({
  service: 'api',
  level: 'debug',
  write: (line) => records.push(JSON.parse(line)),
});
let fixture;
let app;
let protectedApp;
let currentSession;
beforeAll(async () => {
  fixture = await startTestApplication({ auth: true, origin, secret, logger });
  ({ app } = fixture);
  const initial = await request(app.getHttpServer())
    .post('/v1/auth/signup')
    .set('Origin', origin)
    .send(signup);
  expect(initial.status).toBe(201);
  currentSession = initial.body.data;
  const runtime = fixture.runtime;
  const testModule = await Test.createTestingModule({
    imports: [
      AppModule.forProbe({ async check() {}, async close() {} }, { ...runtime, async close() {} }),
    ],
    controllers: [ProtectedController],
  }).compile();
  protectedApp = testModule.createNestApplication();
  await protectedApp.init();
});
afterAll(async () => {
  try {
    await protectedApp?.close();
  } finally {
    await fixture?.close();
  }
});

test('signup atomically creates an admin workspace and returns a safe real session', async () => {
  const response = await request(app.getHttpServer())
    .post('/v1/auth/signup')
    .set('Origin', origin)
    .send({ ...signup, email: 'created@example.com' });
  expect(response.status).toBe(201);
  expect(response.body.data.user.email).toBe('created@example.com');
  expect(response.body.data.activeWorkspace.role).toBe('admin');
  expect(response.body.data.accessToken.split('.')).toHaveLength(3);
  expect(response.headers['set-cookie'][0]).toMatch(/HttpOnly; SameSite=Lax; Expires=.*; Secure$/);
  expect(JSON.stringify(response.body)).not.toMatch(/password|tokenDigest/);
});

test('login normalizes email, creates a fresh session and rejects incorrect credentials uniformly', async () => {
  const valid = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .set('Origin', origin)
    .send({ email: ' NEW@EXAMPLE.COM ', password: signup.password });
  expect(valid.status).toBe(200);
  expect(valid.body.data.user.email).toBe(signup.email);
  expect(valid.headers['cache-control']).toBe('no-store');
  const failures = [];
  for (const email of [signup.email, 'missing@example.com']) {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('Origin', origin)
      .send({ email, password: 'Wrong password!' });
    expect(response.status).toBe(401);
    expect(response.headers['set-cookie']).toBeUndefined();
    failures.push(response.body);
  }
  expect(failures[0]).toEqual(failures[1]);
});

test('body identity injection and unknown query values are rejected', async () => {
  for (const path of ['/v1/auth/signup', '/v1/auth/signup?workspaceId=evil']) {
    const response = await request(app.getHttpServer())
      .post(path)
      .set('Origin', origin)
      .send(path.includes('?') ? signup : { ...signup, role: 'admin', workspaceId: 'evil' });
    expect(response.status).toBe(400);
  }
});

test('missing and disallowed origins cannot obtain cookies; credentialed CORS is explicit', async () => {
  for (const value of [undefined, 'https://evil.example']) {
    const req = request(app.getHttpServer()).post('/v1/auth/login');
    if (value) req.set('Origin', value);

    const response = await req.send({ email: signup.email, password: signup.password });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ORIGIN_REJECTED');
    expect(response.headers['set-cookie']).toBeUndefined();
  }
  const allowed = await request(app.getHttpServer())
    .options('/v1/auth/login')
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'POST');
  expect(allowed.headers['access-control-allow-origin']).toBe(origin);
  expect(allowed.headers['access-control-allow-credentials']).toBe('true');
});

test('an unannotated route requires a signed, current family JWT', async () => {
  const endpoint = () => request(protectedApp.getHttpServer()).get('/protected');
  expect((await endpoint()).status).toBe(401);
  const valid = await endpoint().set('Authorization', `Bearer ${currentSession.accessToken}`);
  expect(valid.status).toBe(200);
  expect(valid.body).toEqual({ role: 'admin', userId: currentSession.user.id });
  const payload = JSON.parse(
    Buffer.from(currentSession.accessToken.split('.')[1], 'base64url').toString(),
  );
  for (const overrides of [
    { exp: 1 },
    { aud: 'another-app' },
    { iss: 'attacker' },
    { sid: '00000000-0000-4000-8000-000000000000' },
    { workspaceId: '00000000-0000-4000-8000-000000000000' },
  ]) {
    const token = await new SignJWT({ ...payload, ...overrides })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .sign(new TextEncoder().encode(secret));
    expect((await endpoint().set('Authorization', `Bearer ${token}`)).status).toBe(401);
  }
  const forged = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(new TextEncoder().encode('different-signature-key-abcdefghijklmnopqrstuvwxyz'));
  expect((await endpoint().set('Authorization', `Bearer ${forged}`)).status).toBe(401);
});

test('duplicate normalized email is409 and does not set a cookie', async () => {
  const response = await request(app.getHttpServer())
    .post('/v1/auth/signup')
    .set('Origin', origin)
    .send({ ...signup, email: ' NEW@EXAMPLE.COM ' });
  expect(response.status).toBe(409);
  expect(response.body.error.code).toBe('EMAIL_IN_USE');
  expect(response.headers['set-cookie']).toBeUndefined();
});

test('credential attempts are limited through Redis', async () => {
  let response;
  for (let index = 0; index < 11; index += 1)
    response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('Origin', origin)
      .send({ email: 'limit@example.com', password: 'Wrong password!' });
  expect(response.status).toBe(429);
  expect(response.body.error.code).toBe('RATE_LIMITED');
  expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
  expect(Number(response.headers['retry-after'])).toBeLessThanOrEqual(900);
});

test('login traces service and database work with verified identity and no credentials', async () => {
  const response = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .set('Origin', origin)
    .send({ email: signup.email, password: signup.password });
  expect(response.status).toBe(200);
  const trace = records.filter(({ requestId }) => requestId === response.headers['x-request-id']);
  expect(
    trace.some(
      ({ event, operation }) =>
        event === 'operation.completed' && operation === 'database.identity',
    ),
  ).toBe(true);
  expect(
    trace.some(
      ({ event, operation }) => event === 'operation.completed' && operation === 'redis.rate_limit',
    ),
  ).toBe(true);
  const completed = trace.find(({ event }) => event === 'http.completed');
  expect(completed.userId).toBe(response.body.data.user.id);
  expect(completed.workspaceId).toBe(response.body.data.activeWorkspace.id);
  for (const value of [
    signup.email,
    signup.password,
    secret,
    response.body.data.accessToken,
    response.headers['set-cookie'][0],
  ])
    expect(JSON.stringify(records)).not.toContain(value);
  const invalid = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .set('Origin', origin)
    .send({ email: signup.email, password: 'invalid-password' });
  expect(invalid.status).toBe(401);
  const rejected = records.filter(({ requestId }) => requestId === invalid.headers['x-request-id']);
  expect(
    rejected.every(({ userId, workspaceId }) => userId === undefined && workspaceId === undefined),
  ).toBe(true);
});
