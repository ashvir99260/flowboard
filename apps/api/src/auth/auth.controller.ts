import { Body, Controller, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodResponse, ZodValidationPipe } from 'nestjs-zod';

import { ErrorResponseDto, HealthQueryDto } from '../platform/health.dto.js';
import { PublicRoute } from '../platform/public.decorator.js';

import { LogInDto, SessionResponseDto, SignUpDto } from './auth.dto.js';
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
