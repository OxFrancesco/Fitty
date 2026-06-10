import { fetchApiJson } from '@/lib/api-base';
import type { GoogleTokenResponse } from '@/lib/google-health';

/** Refresh this many seconds before the access token actually expires. */
const EXPIRY_MARGIN_SECONDS = 120;

export function isAccessTokenFresh(token: GoogleTokenResponse) {
  if (!token.accessToken || !token.expiresIn) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  return token.issuedAt + token.expiresIn - EXPIRY_MARGIN_SECONDS > now;
}

/** Returns the token unchanged while fresh, otherwise refreshes it via the API. */
export async function ensureFreshToken(token: GoogleTokenResponse): Promise<GoogleTokenResponse> {
  if (isAccessTokenFresh(token)) {
    return token;
  }

  if (!token.refreshToken) {
    throw new Error('Session expired. Sign in again.');
  }

  const refreshed = await fetchApiJson<GoogleTokenResponse>('/api/google/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: token.refreshToken }),
  });

  return {
    ...refreshed,
    // Google omits these on refresh responses; keep the originals.
    refreshToken: refreshed.refreshToken ?? token.refreshToken,
    idToken: refreshed.idToken ?? token.idToken,
  };
}
