import { Body, Controller, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ZodResponse, ZodValidationPipe } from 'nestjs-zod';

import { ApiException } from '../platform/api-exception.js';
import { ErrorResponseDto, HealthQueryDto } from '../platform/health.dto.js';
import { PublicRoute } from '../platform/public.decorator.js';

import { EmptyAuthBodyDto, LogInDto, SessionResponseDto, SignUpDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';

import type { SessionEnvelope } from '@flowboard/contracts';
import type { IncomingMessage } from 'node:http';

type CookieResponse = { setHeader(name: string, value: string): void };

@ApiTags('Authentication')
@ApiResponse({ status: 400, type: ErrorResponseDto.Output })
@ApiResponse({ status: 403, type: ErrorResponseDto.Output })
@ApiResponse({
  status: 429,
  type: ErrorResponseDto.Output,
  headers: {
    'Retry-After': {
      description: 'Seconds before another attempt',
      schema: { minimum: 1, type: 'integer' },
    },
  },
})
@ApiResponse({ status: 500, type: ErrorResponseDto.Output })
@ApiResponse({ status: 503, type: ErrorResponseDto.Output })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('refresh')
  @PublicRoute('cookie')
  @ApiCookieAuth('refresh-cookie')
  @ApiOperation({
    operationId: 'refreshSession',
    summary: 'Rotate a single-use refresh credential',
  })
  @ApiResponse({ status: 401, type: ErrorResponseDto.Output })
  @ZodResponse({ status: 200, type: SessionResponseDto })
  async refresh(
    @Body() _input: EmptyAuthBodyDto,
    @Query(new ZodValidationPipe(HealthQueryDto)) _query: Record<string, never>,
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<SessionEnvelope> {
    try {
      const session = await this.auth.refresh(
        request.headers.cookie,
        request.socket.remoteAddress ?? 'unknown',
      );
      response.setHeader('Set-Cookie', session.cookie);
      return session.body;
    } catch (error) {
      if (error instanceof ApiException && error.getStatus() === 401)
        response.setHeader('Set-Cookie', this.auth.expiredCookie());
      throw error;
    }
  }
  @Post('logout')
  @PublicRoute('cookie')
  @ApiCookieAuth('refresh-cookie')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'logOut',
    summary: 'Revoke the session family and clear its cookie',
  })
  @ApiNoContentResponse()
  async logOut(
    @Body() _input: EmptyAuthBodyDto,
    @Query(new ZodValidationPipe(HealthQueryDto)) _query: Record<string, never>,
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    response.setHeader(
      'Set-Cookie',
      await this.auth.logOut(request.headers.cookie, request.socket.remoteAddress ?? 'unknown'),
    );
  }
  @Post('signup')
  @PublicRoute('auth')
  @ApiOperation({ operationId: 'signUp', summary: 'Create an account and workspace' })
  @ApiResponse({ status: 409, type: ErrorResponseDto.Output })
  @ZodResponse({ status: 201, type: SessionResponseDto })
  async signUp(
    @Body() input: SignUpDto,
    @Query(new ZodValidationPipe(HealthQueryDto)) _query: Record<string, never>,
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<SessionEnvelope> {
    const session = await this.auth.signUp(input, request.socket.remoteAddress ?? 'unknown');
    response.setHeader('Set-Cookie', session.cookie);
    return session.body;
  }
  @Post('login')
  @PublicRoute('auth')
  @ApiOperation({ operationId: 'logIn', summary: 'Sign in with email and password' })
  @ApiResponse({ status: 401, type: ErrorResponseDto.Output })
  @ZodResponse({ status: 200, type: SessionResponseDto })
  async logIn(
    @Body() input: LogInDto,
    @Query(new ZodValidationPipe(HealthQueryDto)) _query: Record<string, never>,
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<SessionEnvelope> {
    const session = await this.auth.logIn(input, request.socket.remoteAddress ?? 'unknown');
    response.setHeader('Set-Cookie', session.cookie);
    return session.body;
  }
}
