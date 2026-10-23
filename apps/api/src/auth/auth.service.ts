import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { UuidSchema } from '@flowboard/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

import { ApiException } from '../platform/api-exception.js';

import { AuthRuntimeKey } from './runtime.js';

import type { AuthRuntime } from './runtime.js';
import type { LogIn, SessionEnvelope, SignUp } from '@flowboard/contracts';
import type { IdentitySession } from '@flowboard/database';

const issuer = 'flowboard';
const audience = 'flowboard-api';
const claimsSchema = z.object({
  sid: UuidSchema,
  sub: UuidSchema,
  workspaceId: UuidSchema.nullable(),
});

@Injectable()
export class AuthService {
  constructor(@Inject(AuthRuntimeKey) private readonly runtime: AuthRuntime | undefined) {}
  private requireRuntime() {
    if (!this.runtime)
      throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Authentication service unavailable');
    return this.runtime;
  }
  assertOrigin(origin: string | string[] | undefined) {
    if (
      typeof origin !== 'string' ||
      !this.requireRuntime().settings.allowedOrigins.includes(origin)
    )
      throw new ApiException(403, 'ORIGIN_REJECTED', 'Request origin is not allowed');
  }
  private credential() {
    const token = randomBytes(32).toString('base64url');
    return {
      token,
      value: {
        expiresAt: new Date(Date.now() + 7 * 86400_000),
        familyId: randomUUID(),
        tokenDigest: createHash('sha256').update(token).digest('hex'),
      },
    };
  }
  private async response(session: IdentitySession, refresh: string) {
    const expiresAt = new Date(
      Math.min(
        Math.floor(Date.now() / 1000) * 1000 + 900_000,
        Math.floor(session.expiresAt.getTime() / 1000) * 1000,
      ),
    );
    const accessToken = await new SignJWT({
      sid: session.familyId,
      workspaceId: session.activeWorkspace?.id ?? null,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(session.user.id)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.requireRuntime().settings.secret);
    const serializeAudit = <T extends { createdAt: Date; updatedAt: Date }>(entity: T) => ({
      ...entity,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    });
    const body: SessionEnvelope = {
      data: {
        accessToken,
        activeWorkspace: session.activeWorkspace ? serializeAudit(session.activeWorkspace) : null,
        expiresAt: expiresAt.toISOString(),
        user: serializeAudit(session.user),
      },
    };
    return {
      body,
      cookie: `flowboard_refresh=${refresh}; Path=/; HttpOnly; SameSite=Lax; Expires=${session.expiresAt.toUTCString()}${this.requireRuntime().settings.insecureHttp ? '' : '; Secure'}`,
    };
  }
  async signUp(input: SignUp, ip: string) {
    const runtime = this.requireRuntime();
    await runtime.limit('signup', ip, input.email);
    const credential = this.credential();
    return this.response(
      await runtime.identities.register(input, credential.value),
      credential.token,
    );
  }
  async logIn(input: LogIn, ip: string) {
    const runtime = this.requireRuntime();
    await runtime.limit('login', ip, input.email);
    const credential = this.credential();
    return this.response(await runtime.identities.logIn(input, credential.value), credential.token);
  }
  async authenticate(authorization: string | undefined) {
    const runtime = this.requireRuntime();
    if (!authorization?.match(/^Bearer [A-Za-z0-9_.-]+$/))
      throw new ApiException(401, 'UNAUTHENTICATED', 'Authentication required');
    let claims: z.infer<typeof claimsSchema>;
    try {
      const { payload, protectedHeader } = await jwtVerify(
        authorization.slice(7),
        runtime.settings.secret,
        {
          algorithms: ['HS256'],
          audience,
          issuer,
          requiredClaims: ['exp', 'iat', 'sub', 'sid', 'workspaceId'],
          maxTokenAge: '15m',
        },
      );
      if (protectedHeader.typ !== 'JWT') throw new Error('Invalid token type');
      claims = claimsSchema.parse(payload);
    } catch {
      throw new ApiException(401, 'UNAUTHENTICATED', 'Authentication required');
    }
    return runtime.identities.authenticate({
      familyId: claims.sid,
      userId: claims.sub,
      workspaceId: claims.workspaceId,
    });
  }
}
