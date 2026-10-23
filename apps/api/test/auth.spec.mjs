import { TextEncoder } from 'node:util';

import { initializeDatabase } from '@flowboard/database';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import { Controller, Get, Req } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { SignJWT } from 'jose';
import request from 'supertest';

import { AppModule } from '../dist/app.module.js';
import { createApplication } from '../dist/application.js';
import { AuthGuard } from '../dist/auth/auth.guard.js';
import { createAuthRuntime } from '../dist/auth/runtime.js';
import { readAuthSettings } from '../dist/auth/settings.js';
import { runtimeProbe } from '../dist/platform/dependency-probe.js';

import { startInfrastructure } from './infrastructure.mjs';

let infrastructure;
let app;
const origin = 'https://flowboard.test';
const secret = 'test-only-abcdefghijklmnopqrstuvwxyz123456';
let runtime;
let protectedApp;
let currentSession;
class ProtectedController {
  get(req) {
    return { userId: req.identity.user.id, role: req.identity.activeWorkspace?.role };
  }
}
Controller('protected')(ProtectedController);
Get()(
  ProtectedController.prototype,
  'get',
  Object.getOwnPropertyDescriptor(ProtectedController.prototype, 'get'),
);
Req()(ProtectedController.prototype, 'get', 0);
const signup = {
  email: 'new@example.com',
  name: 'New User',
  password: 'A secure password!',
  workspaceName: 'Personal work',
};
beforeAll(async () => {
  infrastructure = await startInfrastructure();
  await initializeDatabase({ databaseUrl: infrastructure.databaseUrl });
  runtime = createAuthRuntime(
    infrastructure.databaseUrl,
    infrastructure.redisUrl,
    readAuthSettings({ AUTH_SECRET: secret, AUTH_ALLOWED_ORIGINS: origin }),
  );
  ({ app } = await createApplication(
    runtimeProbe(infrastructure.databaseUrl, infrastructure.redisUrl),
    { auth: runtime },
  ));
  const testModule = await Test.createTestingModule({
    imports: [
      AppModule.forProbe({ async check() {}, async close() {} }, { ...runtime, async close() {} }),
    ],
    controllers: [ProtectedController],
  }).compile();
  protectedApp = testModule.createNestApplication();
  await protectedApp.init();
  await app.init();
});
afterAll(async () => {
  await protectedApp?.close();
  await app?.close();
  infrastructure?.close();
});

test('signup atomically creates an admin workspace and returns a safe real session', async () => {
  const response = await request(app.getHttpServer())
    .post('/v1/auth/signup')
    .set('Origin', origin)
    .send(signup);
  expect(response.status).toBe(201);
  expect(response.body.data.user.email).toBe(signup.email);
  expect(response.body.data.activeWorkspace.role).toBe('admin');
  expect(response.body.data.accessToken.split('.')).toHaveLength(3);
  expect(response.headers['set-cookie'][0]).toMatch(/HttpOnly; SameSite=Lax; Expires=.*; Secure$/);
  currentSession = response.body.data;
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

test('unsafe or incomplete auth configuration is rejected', () => {
  expect(() => readAuthSettings({ AUTH_SECRET: 'short' })).toThrow();
  expect(() =>
    readAuthSettings({ AUTH_SECRET: secret, AUTH_ALLOWED_ORIGINS: 'http://flowboard.test' }),
  ).toThrow();
  expect(() =>
    readAuthSettings({
      AUTH_SECRET: secret,
      AUTH_ALLOWED_ORIGINS: 'https://flowboard.test',
      AUTH_ALLOW_INSECURE_HTTP: 'true',
    }),
  ).toThrow();
  expect(
    readAuthSettings({
      AUTH_SECRET: secret,
      AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
      AUTH_ALLOW_INSECURE_HTTP: 'true',
    }).insecureHttp,
  ).toBe(true);
});

test('default member guard rejects a valid identity with no workspace membership', async () => {
  const guard = new AuthGuard(new Reflector(), {
    async authenticate() {
      return { activeWorkspace: null };
    },
  });
  const context = {
    getHandler: () => ProtectedController.prototype.get,
    getClass: () => ProtectedController,
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
  };
  await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED' });
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
