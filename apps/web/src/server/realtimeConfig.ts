import 'server-only';

export function readRealtimeUrl(value: string | undefined): string | null {
  if (!value) return null;

  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('REALTIME_PUBLIC_URL must be a public HTTP(S) origin');

  return url.origin;
}
