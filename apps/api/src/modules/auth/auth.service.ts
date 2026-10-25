import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { UuidSchema } from '@flowboard/contracts';
import { updateLogContext } from '@flowboard/logger';
import { Inject, Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

import { ApiException } from '../../core/common/errors/api-exception.ts';
import { ApiLoggerKey } from '../../core/common/tokens/logger.token.ts';

import { clearRefreshCookie, readRefreshCookie, refreshCookie } from './cookie-policy.ts';
import { AuthRuntimeKey } from './runtime.ts';

import type { AuthRuntime } from './runtime.ts';
import type { LogIn, SessionEnvelope, SignUp } from '@flowboard/contracts';
import type { AuthenticatedIdentity, IdentitySession } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';

const issuer = 'flowboard';
const audience = 'flowboard-api';
const claimsSchema = z.object({
  exp: z.number().int().positive(),
  sid: UuidSchema,
  sub: UuidSchema,
  workspaceId: UuidSchema.nullable(),
});

@Injectable()
export class AuthService {
  constructor(
    @Inject(AuthRuntimeKey) private readonly runtime: AuthRuntime | undefined,
    @Inject(ApiLoggerKey) private readonly logger: Logger,
  ) {}
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
    if (expiresAt.getTime() <= Date.now())
      throw new ApiException(401, 'SESSION_EXPIRED', 'Session expired');

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
    updateLogContext({
      userId: session.user.id,
      ...(session.activeWorkspace ? { workspaceId: session.activeWorkspace.id } : {}),
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
      cookie: refreshCookie(
        refresh,
        session.expiresAt,
        this.requireRuntime().settings.insecureHttp,
      ),
    };
  }
  async signUp(input: SignUp, ip: string) {
    return this.logger.observe('auth.signUp', async () => {
      const runtime = this.requireRuntime();
      await runtime.limit('signup', ip, input.email);
      const credential = this.credential();

      return this.response(
        await runtime.identities.register(input, credential.value),
        credential.token,
      );
    });
  }
  async logIn(input: LogIn, ip: string) {
    return this.logger.observe('auth.logIn', async () => {
      const runtime = this.requireRuntime();
      await runtime.limit('login', ip, input.email);
      const credential = this.credential();

      return this.response(
        await runtime.identities.logIn(input, credential.value),
        credential.token,
      );
    });
  }
  expiredCookie() {
    return clearRefreshCookie(this.requireRuntime().settings.insecureHttp);
  }
  async refresh(cookie: string | undefined, ip: string) {
    return this.logger.observe('auth.refresh', async () => {
      await this.requireRuntime().limit('refresh', ip, '');
      const token = readRefreshCookie(cookie);
      if (!token) throw new ApiException(401, 'SESSION_EXPIRED', 'Session expired');

      const replacement = this.credential();
      const result = await this.requireRuntime().identities.rotate(
        createHash('sha256').update(token).digest('hex'),
        replacement.value.tokenDigest,
      );
      if (result.status === 'reused')
        throw new ApiException(401, 'REFRESH_REUSED', 'Refresh credential already used');

      if (result.status === 'invalid')
        throw new ApiException(401, 'SESSION_EXPIRED', 'Session expired');

      return this.response(result.session, replacement.token);
    });
  }
  async logOut(cookie: string | undefined, ip: string) {
    return this.logger.observe('auth.logOut', async () => {
      const token = readRefreshCookie(cookie);
      await this.requireRuntime().limit('logout', ip, '');
      if (token)
        await this.requireRuntime().identities.revoke(
          createHash('sha256').update(token).digest('hex'),
        );

      return this.expiredCookie();
    });
  }
  async switchWorkspace(
    identity: AuthenticatedIdentity,
    workspaceId: string,
    cookie: string | undefined,
    ip: string,
  ) {
    return this.logger.observe('auth.switchWorkspace', async () => {
      const runtime = this.requireRuntime();
      await runtime.limit('switch', ip, '');
      const token = readRefreshCookie(cookie);
      if (!token) throw new ApiException(401, 'SESSION_EXPIRED', 'Session expired');

      const replacement = this.credential();
      const result = await runtime.identities.switchWorkspace(
        {
          userId: identity.user.id,
          familyId: identity.familyId,
          workspaceId: identity.selectedWorkspaceId,
        },
        createHash('sha256').update(token).digest('hex'),
        replacement.value.tokenDigest,
        workspaceId,
      );
      if (result.status === 'invalid')
        throw new ApiException(401, 'SESSION_EXPIRED', 'Session expired');

      if (result.status === 'reused')
        throw new ApiException(401, 'REFRESH_REUSED', 'Refresh credential already used');

      return this.response(result.session, replacement.token);
    });
  }
  async authenticate(authorization: string | undefined, sessionOnly = false) {
    return (await this.authenticateAccess(authorization, sessionOnly)).identity;
  }
  async authenticateAccess(authorization: string | undefined, sessionOnly = false) {
    return this.logger.observe('auth.authenticate', async () => {
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
      const session = await runtime.identities.authenticate(
        {
          familyId: claims.sid,
          userId: claims.sub,
          workspaceId: claims.workspaceId,
        },
        sessionOnly,
      );
      updateLogContext({
        userId: session.user.id,
        ...(session.activeWorkspace ? { workspaceId: session.activeWorkspace.id } : {}),
      });

      return { identity: session, accessExpiresAt: new Date(claims.exp * 1000) };
    });
  }
}
