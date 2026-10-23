import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import { expect, test } from '@jest/globals';
import request from 'supertest';

import { startTestApplication } from '../../../test/common/application.mjs';
import { cookieOf, SignupFixture as signup } from '../../../test/common/auth-fixtures.mjs';

test('local Swagger signs in, rotates and logs out while unlisted origins stay blocked', async () => {
  const environment = parseEnv(
    readFileSync(new URL('../../../../../.env.example', import.meta.url), 'utf8'),
  );
  const fixture = await startTestApplication({
    auth: true,
    exposeDocs: true,
    insecureHttp: environment.AUTH_ALLOW_INSECURE_HTTP === 'true',
    origin: environment.AUTH_ALLOWED_ORIGINS,
  });
  const server = fixture.app.getHttpServer();
  const docsOrigin = 'http://localhost:3001';
  try {
    expect((await request(server).get('/docs/')).status).toBe(200);
    const created = await request(server)
      .post('/v1/auth/signup')
      .set('Origin', 'http://localhost:3000')
      .send(signup);
    expect(created.status).toBe(201);
    const login = await request(server)
      .post('/v1/auth/login')
      .set('Origin', docsOrigin)
      .send({ email: signup.email, password: signup.password });
    expect(login.status).toBe(200);
    expect(login.headers['access-control-allow-origin']).toBe(docsOrigin);
    expect(login.headers['access-control-allow-credentials']).toBe('true');
    expect(cookieOf(login)).toMatch(/^flowboard_refresh=.+/);
    for (const origin of [undefined, 'http://localhost:3999', 'https://evil.example']) {
      const req = request(server).post('/v1/auth/refresh').set('Cookie', cookieOf(login));
      if (origin) req.set('Origin', origin);

      const rejected = await req.send({});
      expect(rejected.status).toBe(403);
      expect(rejected.body.error.code).toBe('ORIGIN_REJECTED');
      expect(rejected.headers['set-cookie']).toBeUndefined();
    }
    const refresh = await request(server)
      .post('/v1/auth/refresh')
      .set('Origin', docsOrigin)
      .set('Cookie', cookieOf(login))
      .send({});
    expect(refresh.status).toBe(200);
    expect(cookieOf(refresh)).not.toBe(cookieOf(login));
    const logout = await request(server)
      .post('/v1/auth/logout')
      .set('Origin', docsOrigin)
      .set('Cookie', cookieOf(refresh))
      .send({});
    expect(logout.status).toBe(204);
    expect(cookieOf(logout)).toBe('flowboard_refresh=');
  } finally {
    await fixture.close();
  }
});
