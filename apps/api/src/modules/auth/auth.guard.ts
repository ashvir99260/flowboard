import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PublicRouteKey } from '../../core/common/decorators/public.decorator.ts';
import { SessionRouteKey } from '../../core/common/decorators/session-route.decorator.ts';
import { ApiException } from '../../core/common/errors/api-exception.ts';

import { AuthService } from './auth.service.ts';

import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (context.getType?.() === 'ws') {
      const socket = context.switchToWs().getClient<{
        connected: boolean;
        handshake: { auth: { token?: string }; headers: { origin?: string } };
        identity?: Awaited<ReturnType<AuthService['authenticate']>>;
      }>();
      if (!socket.connected) throw new ApiException(401, 'UNAUTHENTICATED', 'Socket disconnected');

      this.auth.assertOrigin(socket.handshake.headers.origin);
      const token = socket.handshake.auth.token;
      const identity = await this.auth.authenticate(
        typeof token === 'string' ? `Bearer ${token}` : undefined,
      );
      if (!socket.connected) throw new ApiException(401, 'UNAUTHENTICATED', 'Socket disconnected');

      socket.identity = identity;

      return true;
    }

    const policy = this.reflector.getAllAndOverride<string>(PublicRouteKey, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context
      .switchToHttp()
      .getRequest<
        IncomingMessage & { identity?: Awaited<ReturnType<AuthService['authenticate']>> }
      >();
    if (policy === 'health') return true;

    if (policy === 'auth' || policy === 'cookie') {
      this.auth.assertOrigin(request.headers.origin);

      return true;
    }

    const sessionPolicy = this.reflector.getAllAndOverride<{ cookie: boolean }>(SessionRouteKey, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (sessionPolicy?.cookie) this.auth.assertOrigin(request.headers.origin);

    request.identity = await this.auth.authenticate(request.headers.authorization, !!sessionPolicy);
    if (!request.identity.activeWorkspace && !sessionPolicy)
      throw new ApiException(403, 'MEMBERSHIP_REQUIRED', 'Workspace membership required');

    return true;
  }
}
