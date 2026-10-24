import { readBooleanSetting } from '../../core/utils/read-boolean-setting.ts';

export interface AuthSettings {
  allowedOrigins: string[];
  insecureHttp: boolean;
  secret: Uint8Array;
}

export function readAuthSettings(environment: NodeJS.ProcessEnv): AuthSettings {
  const value = environment.AUTH_SECRET ?? '';
  if (Buffer.byteLength(value) < 32) throw new Error('AUTH_SECRET must contain at least 32 bytes');

  const insecureHttp =
    readBooleanSetting(environment.AUTH_ALLOW_INSECURE_HTTP, 'AUTH_ALLOW_INSECURE_HTTP') ?? false;
  if (!insecureHttp && value === 'flowboard-local-only-change-before-hosting-64-bytes')
    throw new Error('Replace the local-only AUTH_SECRET before hosting');

  const allowedOrigins = (environment.AUTH_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!allowedOrigins.length) throw new Error('AUTH_ALLOWED_ORIGINS is required');

  for (const origin of allowedOrigins) {
    const url = new URL(origin);
    if (
      url.origin !== origin ||
      (url.protocol !== 'https:' &&
        !(
          insecureHttp &&
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        ))
    )
      throw new Error(
        'AUTH_ALLOWED_ORIGINS must contain exact HTTPS origins or explicitly enabled local HTTP origins',
      );

    if (insecureHttp && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
      throw new Error('Insecure cookies are restricted to local development');
  }

  return { allowedOrigins, insecureHttp, secret: new TextEncoder().encode(value) };
}
