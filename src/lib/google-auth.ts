import * as ExpoCrypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { fetchApiJson } from '@/lib/api-base';
import {
    GOOGLE_HEALTH_SCOPES,
    GOOGLE_OAUTH_DISCOVERY,
    type GoogleHealthConfig,
    type GoogleTokenResponse,
} from '@/lib/google-health';
import {
    clearPendingGoogleOAuth,
    loadPendingGoogleOAuth,
    savePendingGoogleOAuth,
} from '@/lib/google-oauth-pending';

WebBrowser.maybeCompleteAuthSession();

/** Refresh this many seconds before the access token actually expires. */
const EXPIRY_MARGIN_SECONDS = 120;

export const GOOGLE_NATIVE_REDIRECT_URI = 'fitty://oauth';

// States whose one-time code has already been exchanged — guards against a
// re-delivered OAuth return (e.g. a re-run route effect) exchanging it twice.
const processedOAuthStates = new Set<string>();

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

export function isGoogleConfigReady(config: GoogleHealthConfig | null): config is GoogleHealthConfig {
  return Boolean(config?.clientId && config.hasClientSecret && config.redirectUri && config.appReturnUri);
}

export async function fetchGoogleConfig() {
  return fetchApiJson<GoogleHealthConfig>(`/api/google/config?platform=${Platform.OS}`);
}

/** Reuses an already-ready config, otherwise fetches one from the API server. */
export async function resolveGoogleConfig(current: GoogleHealthConfig | null) {
  return isGoogleConfigReady(current) ? current : fetchGoogleConfig();
}

export function requireReadyGoogleConfig(config: GoogleHealthConfig | null) {
  if (!isGoogleConfigReady(config)) {
    throw new Error('Google OAuth config is incomplete. Check the API server environment.');
  }

  return config;
}

function createOAuthState(appReturnUri: string) {
  return `${ExpoCrypto.randomUUID()}.${encodeURIComponent(appReturnUri)}`;
}

function buildGoogleAuthUrl(config: GoogleHealthConfig, state: string) {
  const url = new URL(GOOGLE_OAUTH_DISCOVERY.authorizationEndpoint);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_HEALTH_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);

  if (Platform.OS === 'web') {
    url.searchParams.set('include_granted_scopes', 'true');
  }

  return url.toString();
}

export type GoogleOAuthStart =
  | { type: 'success'; params: URLSearchParams; state: string }
  | { type: 'dismissed' };

/**
 * Opens the Google consent flow in a browser session. The pending state is
 * persisted first so a return that arrives via deep link — possibly after the
 * app restarted — can still be validated.
 */
export async function startGoogleOAuth(config: GoogleHealthConfig): Promise<GoogleOAuthStart> {
  const appReturnUri = config.appReturnUri || GOOGLE_NATIVE_REDIRECT_URI;
  const state = createOAuthState(appReturnUri);
  await savePendingGoogleOAuth(state);

  const result = await WebBrowser.openAuthSessionAsync(
    buildGoogleAuthUrl(config, state),
    appReturnUri
  );

  if (result.type !== 'success') {
    await clearPendingGoogleOAuth().catch(() => undefined);
    return { type: 'dismissed' };
  }

  return { type: 'success', params: new URL(result.url).searchParams, state };
}

/**
 * Validates an OAuth return against the pending sign-in and exchanges its
 * one-time code for tokens. Returns null when this state was already handled
 * (a duplicate delivery of the same return). Pending state is cleared on
 * terminal outcomes (success or an OAuth error response); a mismatched or
 * unknown state leaves it intact so a live attempt can still complete.
 */
export async function completeGoogleOAuth(
  searchParams: URLSearchParams,
  config: GoogleHealthConfig,
  expectedState?: string
): Promise<GoogleTokenResponse | null> {
  const returnedState = searchParams.get('state');
  const oauthError = searchParams.get('error_description') ?? searchParams.get('error');
  const code = searchParams.get('code');

  if (!returnedState) {
    throw new Error('Google OAuth state was missing. Try signing in again.');
  }

  const pendingState = expectedState ?? (await loadPendingGoogleOAuth())?.state;

  if (!pendingState) {
    throw new Error('Google OAuth session was not found. Start sign-in again.');
  }

  if (returnedState !== pendingState) {
    throw new Error('Google OAuth state did not match. Try signing in again.');
  }

  if (oauthError) {
    await clearPendingGoogleOAuth().catch(() => undefined);
    throw new Error(oauthError);
  }

  if (processedOAuthStates.has(returnedState)) {
    return null;
  }

  processedOAuthStates.add(returnedState);

  try {
    // The callback forwards the one-time code; exchange it server-side
    // (stateless — no session has to survive between serverless requests).
    // Fall back to the legacy session lookup for older server deployments.
    const token = code
      ? await fetchApiJson<GoogleTokenResponse>('/api/google/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirectUri: config.redirectUri }),
        })
      : await fetchApiJson<GoogleTokenResponse>(
          `/api/google/session?state=${encodeURIComponent(returnedState)}`
        );

    await clearPendingGoogleOAuth().catch(() => undefined);
    return token;
  } catch (exchangeError) {
    processedOAuthStates.delete(returnedState);
    throw exchangeError;
  }
}
