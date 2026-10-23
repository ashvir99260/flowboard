import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PublicRouteKey } from '../../common/decorators/public.decorator.js';
import { ApiException } from '../../common/errors/api-exception.js';

import { AuthService } from './auth.service.js';

import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}
  async canActivate(context: ExecutionContext) {
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
    request.identity = await this.auth.authenticate(request.headers.authorization);
    if (!request.identity.activeWorkspace)
      throw new ApiException(403, 'MEMBERSHIP_REQUIRED', 'Workspace membership required');
    return true;
  }
}
