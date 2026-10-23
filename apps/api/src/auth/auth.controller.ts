import { AuthExamples, ErrorExamples } from '@flowboard/contracts';
import { Body, Controller, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiExtraModels,
  ApiHeader,
  ApiNoContentResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ZodResponse, ZodValidationPipe } from 'nestjs-zod';

import { PublicRoute } from '../common/decorators/public.decorator.js';
import { EmptyQueryDto } from '../common/dto/empty-query.dto.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ApiException } from '../common/errors/api-exception.js';
import {
  AuthResponseHeaders,
  ClearedSessionHeaders,
  documentedError,
  OriginDocumentation,
  SessionResponseHeaders,
} from '../common/swagger/api-documentation.js';

import { AuthService } from './auth.service.js';
import { EmptyAuthBodyDto } from './empty-auth-body.dto.js';
import { LogInDto } from './log-in.dto.js';
import { SessionResponseDto } from './session-response.dto.js';
import { SignUpDto } from './sign-up.dto.js';

import type { SessionEnvelope } from '@flowboard/contracts';
import type { IncomingMessage } from 'node:http';

type CookieResponse = { setHeader(name: string, value: string): void };

@ApiTags('Authentication')
@ApiExtraModels(SignUpDto, LogInDto, EmptyAuthBodyDto)
@ApiHeader(OriginDocumentation)
@ApiResponse(documentedError(400, true))
@ApiResponse(documentedError(403, true))
@ApiResponse({
  ...documentedError(429, true),
  headers: {
    ...AuthResponseHeaders,
    'Retry-After': {
      description: 'Remaining wait before retrying. The applicable window depends on the endpoint.',
      schema: {
        description: 'Positive number of seconds to wait.',
        example: 60,
        minimum: 1,
        title: 'Retry delay',
        type: 'integer',
      },
    },
  },
})
@ApiResponse(documentedError(413, true))
@ApiResponse(documentedError(500, true))
@ApiResponse(documentedError(503, true))
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('refresh')
  @PublicRoute('cookie')
  @ApiCookieAuth('refresh-cookie')
  @ApiOperation({
    description:
      'Exchange the httpOnly refresh cookie for a new access token and rotated cookie. No access JWT is required. The original seven-day family expiry is retained; replay of a consumed cookie revokes the whole family.',
    operationId: 'refreshSession',
    summary: 'Rotate a single-use refresh credential',
  })
  @ApiBody({
    description: 'Optional empty JSON body. Identity and workspace fields are never accepted.',
    required: false,
    schema: { $ref: getSchemaPath(EmptyAuthBodyDto) },
    examples: {
      empty: {
        summary: 'Empty refresh request',
        description: 'The credential is sent as a cookie, not a body field.',
        value: {},
      },
    },
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto.Output,
    description:
      'The refresh cookie is missing, invalid, expired or previously consumed. Invalid cookies are cleared; replay revokes the family.',
    headers: ClearedSessionHeaders,
    examples: {
      expired: { summary: 'Expired or missing credential', value: ErrorExamples.refreshExpired },
      reused: { summary: 'Consumed credential replay', value: ErrorExamples.refreshReused },
    },
  })
  @ApiResponse({
    status: 200,
    example: AuthExamples.session,
    type: SessionResponseDto.Output,
    headers: SessionResponseHeaders,
  })
  @ZodResponse({
    status: 200,
    description:
      'New access token and safe session data; Set-Cookie contains the rotated refresh credential.',
    type: SessionResponseDto,
  })
  async refresh(
    @Body() _input: EmptyAuthBodyDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
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
    description:
      'Revoke the family identified by the refresh cookie and expire that cookie. Missing, unknown and already revoked credentials succeed idempotently. An allowed Origin is still required.',
    operationId: 'logOut',
    summary: 'Revoke the session family and clear its cookie',
  })
  @ApiBody({
    description: 'Optional empty JSON body. Logout identifies the family through its cookie.',
    required: false,
    schema: { $ref: getSchemaPath(EmptyAuthBodyDto) },
    examples: {
      empty: {
        summary: 'Empty logout request',
        description: 'No user ID, workspace ID or token body is needed.',
        value: {},
      },
    },
  })
  @ApiNoContentResponse({
    description:
      'The session is logged out and the cookie is expired. This response intentionally has no JSON body.',
    headers: ClearedSessionHeaders,
  })
  async logOut(
    @Body() _input: EmptyAuthBodyDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
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
  @ApiOperation({
    description:
      'Create a user, workspace, admin membership and default statuses atomically. The server chooses all identifiers and the acting role. Returns the initial access token and an httpOnly refresh cookie.',
    operationId: 'signUp',
    summary: 'Create an account and workspace',
  })
  @ApiBody({
    description:
      'New account and workspace details. The example password is illustrative, not a configured demo credential.',
    required: true,
    schema: { $ref: getSchemaPath(SignUpDto) },
    examples: {
      signup: {
        summary: 'Create a personal workspace',
        description: 'Example-only account details; choose a unique email and your own password.',
        value: AuthExamples.signUp,
      },
    },
  })
  @ApiResponse(documentedError(409, true))
  @ApiResponse({
    status: 201,
    example: AuthExamples.session,
    type: SessionResponseDto.Output,
    headers: SessionResponseHeaders,
  })
  @ZodResponse({
    status: 201,
    description:
      'Account and workspace created; initial access token and safe session details returned.',
    type: SessionResponseDto,
  })
  async signUp(
    @Body() input: SignUpDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<SessionEnvelope> {
    const session = await this.auth.signUp(input, request.socket.remoteAddress ?? 'unknown');
    response.setHeader('Set-Cookie', session.cookie);
    return session.body;
  }
  @Post('login')
  @PublicRoute('auth')
  @ApiOperation({
    description:
      'Verify normalized email and the exact password, then create a fresh login family. Select the first workspace membership deterministically, or return a null workspace when none exists. Credentials are never echoed.',
    operationId: 'logIn',
    summary: 'Sign in with email and password',
  })
  @ApiBody({
    description:
      'Existing account credentials. Password whitespace is significant; email is trimmed and normalized.',
    required: true,
    schema: { $ref: getSchemaPath(LogInDto) },
    examples: {
      login: {
        summary: 'Sign in to an existing account',
        description: 'Illustrative credentials only. Replace them with an account you created.',
        value: AuthExamples.logIn,
      },
    },
  })
  @ApiResponse(documentedError(401, true))
  @ApiResponse({
    status: 200,
    example: AuthExamples.session,
    type: SessionResponseDto.Output,
    headers: SessionResponseHeaders,
  })
  @ZodResponse({
    status: 200,
    description:
      'Fresh access token, safe user and selected workspace; the refresh credential is set as an httpOnly cookie.',
    type: SessionResponseDto,
  })
  async logIn(
    @Body() input: LogInDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<SessionEnvelope> {
    const session = await this.auth.logIn(input, request.socket.remoteAddress ?? 'unknown');
    response.setHeader('Set-Cookie', session.cookie);
    return session.body;
  }
}
