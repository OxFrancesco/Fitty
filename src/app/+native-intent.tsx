import { hasOAuthParams } from '@/lib/oauth-params';

const APP_SCHEMES = new Set(['fitty:', 'com.francescooddo.fitty:']);

function isOAuthUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.replace(/^\/+/, '').toLowerCase();

  return (
    APP_SCHEMES.has(url.protocol) &&
    hasOAuthParams(url.searchParams) &&
    (hostname === 'oauth' || pathname === 'oauth')
  );
}

function normalizeOAuthRedirectPath(path: string) {
  const candidates = [
    () => new URL(path),
    () => new URL(path, 'fitty://app'),
  ];

  for (const createUrl of candidates) {
    try {
      const url = createUrl();

      if (isOAuthUrl(url)) {
        return `/${url.search}`;
      }
    } catch {
      // Incoming native intents are not guaranteed to be valid URLs.
    }
  }

  const queryStart = path.indexOf('?');
  const rawPath = queryStart >= 0 ? path.slice(0, queryStart) : path;
  const rawQuery = queryStart >= 0 ? path.slice(queryStart + 1) : '';
  const searchParams = new URLSearchParams(rawQuery);

  if (rawPath.replace(/^\/+/, '').toLowerCase() === 'oauth' && hasOAuthParams(searchParams)) {
    return `/?${searchParams.toString()}`;
  }

  return null;
}

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return normalizeOAuthRedirectPath(path) ?? path;
  } catch {
    return '/';
  }
}
