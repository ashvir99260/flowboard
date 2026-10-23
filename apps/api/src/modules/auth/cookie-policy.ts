const name = 'flowboard_refresh';

export function readRefreshCookie(header: string | undefined): string | undefined {
  const values = (header ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (values.length !== 1) return undefined;

  const value = values[0]!.slice(name.length + 1);

  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}

export function refreshCookie(token: string, expiresAt: Date, insecure: boolean): string {
  return `${name}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${insecure ? '' : '; Secure'}`;
}

export function clearRefreshCookie(insecure: boolean): string {
  return `${refreshCookie('', new Date(0), insecure)}; Max-Age=0`;
}
