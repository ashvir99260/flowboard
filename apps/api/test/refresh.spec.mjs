import { initializeDatabase } from '@flowboard/database';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';

import { createApplication } from '../dist/application.js';
import { createAuthRuntime } from '../dist/auth/runtime.js';
import { readAuthSettings } from '../dist/auth/settings.js';
import { runtimeProbe } from '../dist/platform/dependency-probe.js';

import { startInfrastructure } from './infrastructure.mjs';

let infrastructure;
let app;
const origin = 'https://flowboard.test';
const call = (path) => request(app.getHttpServer()).post(`/v1/auth/${path}`).set('Origin', origin);
beforeAll(async () => {
  infrastructure = await startInfrastructure();
  await initializeDatabase({ databaseUrl: infrastructure.databaseUrl });
  const auth = createAuthRuntime(
    infrastructure.databaseUrl,
    infrastructure.redisUrl,
    readAuthSettings({
      AUTH_SECRET: 'refresh-test-secret-abcdefghijklmnopqrstuvwxyz',
      AUTH_ALLOWED_ORIGINS: origin,
    }),
  );
  ({ app } = await createApplication(
    runtimeProbe(infrastructure.databaseUrl, infrastructure.redisUrl),
    { auth },
  ));
  await app.init();
});
afterAll(async () => {
  await app?.close();
  infrastructure?.close();
});

test('refresh rotates the cookie and returns a real session without an access JWT', async () => {
  const signup = await call('signup').send({
    email: 'refresh@example.com',
    name: 'Refresh User',
    password: 'Refresh password!',
    workspaceName: 'Refresh workspace',
  });
  expect(signup.status).toBe(201);
  const cookie = signup.headers['set-cookie'][0].split(';')[0];
  const refreshed = await call('refresh').set('Cookie', cookie).send({});
  expect(refreshed.status).toBe(200);
  expect(refreshed.headers['set-cookie'][0].split(';')[0]).not.toBe(cookie);
  expect(refreshed.body.data.user.id).toBe(signup.body.data.user.id);
});

let counter = 0;
const cookieOf = (response) => response.headers['set-cookie'][0].split(';')[0];
const claimsOf = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
async function fresh() {
  const response = await call('signup').send({
    email: `fresh-${++counter}@example.com`,
    name: 'Fresh User',
    password: 'Refresh password!',
    workspaceName: 'Fresh workspace',
  });
  expect(response.status).toBe(201);
  return response;
}

test('rotation preserves family, workspace and fixed cookie expiry', async () => {
  const initial = await fresh();
  const rotated = await call('refresh').set('Cookie', cookieOf(initial));
  expect(rotated.status).toBe(200);
  const oldClaims = claimsOf(initial.body.data.accessToken);
  const newClaims = claimsOf(rotated.body.data.accessToken);
  expect(newClaims.sid).toBe(oldClaims.sid);
  expect(newClaims.workspaceId).toBe(oldClaims.workspaceId);
  expect(rotated.headers['set-cookie'][0].split('Expires=')[1]).toBe(
    initial.headers['set-cookie'][0].split('Expires=')[1],
  );
  const { AuthService } = await import('../dist/auth/auth.service.js');
  await expect(
    app.get(AuthService).authenticate(`Bearer ${initial.body.data.accessToken}`),
  ).resolves.toBeDefined();
});

test('replaying a used cookie revokes both old and latest access tokens', async () => {
  const initial = await fresh();
  const rotated = await call('refresh').set('Cookie', cookieOf(initial)).send({});
  expect(rotated.status).toBe(200);
  const replay = await call('refresh').set('Cookie', cookieOf(initial)).send({});
  expect(replay.status).toBe(401);
  expect(replay.body.error.code).toBe('REFRESH_REUSED');
  expect(replay.headers['set-cookie'][0]).toContain('Max-Age=0');
  const { AuthService } = await import('../dist/auth/auth.service.js');
  for (const response of [initial, rotated])
    await expect(
      app.get(AuthService).authenticate(`Bearer ${response.body.data.accessToken}`),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  expect((await call('refresh').set('Cookie', cookieOf(rotated)).send({})).status).toBe(401);
});

test('concurrent reuse has one rotation and one replay; its winning token is revoked', async () => {
  const initial = await fresh();
  const responses = await Promise.all([
    call('refresh').set('Cookie', cookieOf(initial)).send({}),
    call('refresh').set('Cookie', cookieOf(initial)).send({}),
  ]);
  expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
  const winner = responses.find((response) => response.status === 200);
  const { AuthService } = await import('../dist/auth/auth.service.js');
  await expect(
    app.get(AuthService).authenticate(`Bearer ${winner.body.data.accessToken}`),
  ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
});

test('logout revokes the family, expires the cookie and is idempotent', async () => {
  const initial = await fresh();
  for (const cookie of [
    cookieOf(initial),
    cookieOf(initial),
    undefined,
    `flowboard_refresh=${'a'.repeat(43)}`,
  ]) {
    const req = call('logout');
    if (cookie) req.set('Cookie', cookie);
    const response = await req.send({});
    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(response.headers['set-cookie'][0]).toContain('Max-Age=0');
    expect(response.headers['cache-control']).toBe('no-store');
  }
  const { AuthService } = await import('../dist/auth/auth.service.js');
  await expect(
    app.get(AuthService).authenticate(`Bearer ${initial.body.data.accessToken}`),
  ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
});

test('untrusted Origin and injected body/query cannot consume a valid credential', async () => {
  const initial = await fresh();
  for (const endpoint of ['refresh', 'logout']) {
    const forbidden = await request(app.getHttpServer())
      .post(`/v1/auth/${endpoint}`)
      .set('Origin', 'https://evil.test')
      .set('Cookie', cookieOf(initial))
      .send({});
    expect(forbidden.status).toBe(403);
    expect(forbidden.headers['set-cookie']).toBeUndefined();
    const missingOrigin = await request(app.getHttpServer())
      .post(`/v1/auth/${endpoint}`)
      .set('Cookie', cookieOf(initial))
      .send({});
    expect(missingOrigin.status).toBe(403);
  }
  expect(
    (await call('refresh').set('Cookie', cookieOf(initial)).send({ workspaceId: 'attacker' }))
      .status,
  ).toBe(400);
  expect((await call('refresh?role=admin').set('Cookie', cookieOf(initial)).send({})).status).toBe(
    400,
  );
  expect((await call('refresh').set('Cookie', cookieOf(initial)).send({})).status).toBe(200);
});

test('missing, malformed, unknown and duplicate cookies fail closed and are cleared', async () => {
  const initial = await fresh();
  for (const cookie of [
    undefined,
    'flowboard_refresh=bad',
    `flowboard_refresh=${'a'.repeat(43)}`,
    `${cookieOf(initial)}; ${cookieOf(initial)}`,
  ]) {
    const req = call('refresh');
    if (cookie) req.set('Cookie', cookie);
    const response = await req.send({});
    expect(response.status).toBe(401);
    expect(response.headers['set-cookie'][0]).toContain('Max-Age=0');
  }
  expect((await call('refresh').set('Cookie', cookieOf(initial)).send({})).status).toBe(200);
});

test('refresh and logout apply bounded rate limits even without a valid cookie', async () => {
  for (const operation of ['refresh', 'logout']) {
    let response;
    for (let index = 0; index < 121; index += 1) response = await call(operation).send({});
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMITED');
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(response.headers['retry-after'])).toBeLessThanOrEqual(60);
  }
});
