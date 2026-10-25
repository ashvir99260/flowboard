import { ErrorExamples } from '@flowboard/contracts';

import { ErrorResponseDto } from '../dto/error-response.dto.ts';

import type { ApiResponseOptions } from '@nestjs/swagger';

export const RequestIdHeaders = {
  'X-Request-Id': {
    description:
      'Server-generated identifier for correlating this request without logging credentials.',
    example: '10000000-0000-4000-8000-000000000003',
    schema: {
      description: 'A unique request identifier.',
      format: 'uuid',
      title: 'Request ID',
      type: 'string',
    },
  },
};

export const AuthResponseHeaders = {
  ...RequestIdHeaders,
  'Cache-Control': {
    description: 'Authentication responses must not be stored by browsers or shared caches.',
    example: 'no-store',
    schema: { description: 'Disable response storage.', title: 'Cache policy', type: 'string' },
  },
};

export const SessionResponseHeaders = {
  ...AuthResponseHeaders,
  'Set-Cookie': {
    description:
      'Opaque single-use refresh credential. Secure on HTTPS; only explicit local HTTP mode omits Secure. This example is synthetic and cannot authenticate.',
    example:
      'flowboard_refresh=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA; Path=/; HttpOnly; SameSite=Lax; Expires=Fri, 30 Oct 2026 10:00:00 GMT; Secure',
    schema: {
      description: 'Host-only refresh cookie; never copy it into application storage.',
      title: 'Refresh cookie',
      type: 'string',
    },
  },
};

export const ClearedSessionHeaders = {
  ...AuthResponseHeaders,
  'Set-Cookie': {
    description:
      'Expire the refresh cookie with the same path/security attributes after logout or invalid refresh.',
    example:
      'flowboard_refresh=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; Max-Age=0',
    schema: {
      description: 'Expired host-only refresh cookie.',
      title: 'Cleared refresh cookie',
      type: 'string',
    },
  },
};

export const OriginDocumentation = {
  description:
    'Exact allowlisted web origin. Browsers supply Origin automatically; command-line clients must set it. Swagger Try it out requires its own origin to be allowlisted.',
  name: 'Origin',
  required: true,
  schema: {
    description: 'An allowed scheme, host and optional port without a path.',
    example: 'http://localhost:3000',
    format: 'uri',
    title: 'Request origin',
    type: 'string',
  },
};

const descriptions = {
  400: 'The body or query failed validation. Details identify invalid fields or unexpected keys.',
  401: 'Email or password is incorrect. The same response is used for unknown accounts.',
  403: 'The request origin is not allowed or the selected workspace membership is unavailable.',
  404: 'The requested resource was not found in the selected workspace.',
  409: 'The normalized email address is already registered. No partial account or workspace was created.',
  413: 'The JSON request exceeds the 256 KiB body limit.',
  429: 'The authentication attempt limit was reached. Retry after the indicated number of seconds.',
  500: 'An unexpected internal failure occurred. The response omits internal details and credentials.',
  503: 'A required dependency is unavailable or did not respond before its timeout.',
};
export function documentedError(
  status: keyof typeof descriptions,
  auth = false,
): ApiResponseOptions {
  return {
    description: descriptions[status],
    example: ErrorExamples[status],
    headers: auth ? AuthResponseHeaders : RequestIdHeaders,
    status,
    type: ErrorResponseDto.Output,
  };
}

/** Resource endpoints share status semantics without reusing login-specific examples. */
export function documentedAccessError(
  status: 400 | 401 | 403 | 404 | 409 | 500 | 503,
): ApiResponseOptions {
  const overrides = {
    401: {
      description: 'A valid access token is required.',
      example: { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
    },
    403: {
      description: 'Current workspace membership or permission is insufficient.',
      example: { error: { code: 'FORBIDDEN', message: 'Access denied' } },
    },
    409: {
      description:
        'Configuration or collection changed; reload state or restart cursor pagination.',
      example: { error: { code: 'CONFIG_CONFLICT', message: 'Workspace configuration changed' } },
    },
  };

  return {
    ...documentedError(status),
    ...(status in overrides ? overrides[status as keyof typeof overrides] : {}),
  };
}
