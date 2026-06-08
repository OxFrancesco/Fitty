import type { GoogleTokenResponse } from '@/lib/google-health';

const DEFAULT_GOOGLE_CALLBACK_URI = 'http://localhost:8081/api/google/callback';
const DEFAULT_APP_RETURN_URI = 'com.francescooddo.fitty:/oauth';
const SESSION_TTL_MS = 2 * 60 * 1000;

type OAuthStore = Map<string, { token: GoogleTokenResponse; expiresAt: number }>;

type ExchangeGoogleCodeInput = {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  includeClientSecret?: boolean;
};

const storeKey = Symbol.for('fitty.googleOAuthSessions');

function getStore() {
  const globalWithStore = globalThis as typeof globalThis & {
    [storeKey]?: OAuthStore;
  };

  if (!globalWithStore[storeKey]) {
    globalWithStore[storeKey] = new Map();
  }

  return globalWithStore[storeKey];
}

function cleanupExpiredSessions(store: OAuthStore) {
  const now = Date.now();

  for (const [state, session] of store.entries()) {
    if (session.expiresAt <= now) {
      store.delete(state);
    }
  }
}

export function getGoogleCallbackUri() {
  return process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI ?? process.env.GOOGLE_REDIRECT_URI ?? DEFAULT_GOOGLE_CALLBACK_URI;
}

export function getGoogleAppReturnUri() {
  return process.env.EXPO_PUBLIC_GOOGLE_APP_RETURN_URI ?? process.env.GOOGLE_APP_RETURN_URI ?? DEFAULT_APP_RETURN_URI;
}

export function storeGoogleOAuthSession(state: string, token: GoogleTokenResponse) {
  const store = getStore();
  cleanupExpiredSessions(store);
  store.set(state, { token, expiresAt: Date.now() + SESSION_TTL_MS });
}

export function takeGoogleOAuthSession(state: string) {
  const store = getStore();
  cleanupExpiredSessions(store);
  const session = store.get(state);

  if (!session) {
    return null;
  }

  store.delete(state);
  return session.token;
}

export async function exchangeGoogleCode({
  code,
  redirectUri,
  codeVerifier,
  includeClientSecret,
}: ExchangeGoogleCodeInput) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId) {
    throw new Error('Missing GOOGLE_CLIENT_ID in .env.local');
  }

  if (includeClientSecret && !clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_SECRET in .env.local');
  }

  const form = new URLSearchParams({
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  if (includeClientSecret && clientSecret) {
    form.set('client_secret', clientSecret);
  }

  if (codeVerifier) {
    form.set('code_verifier', codeVerifier);
  }

  const googleResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const text = await googleResponse.text();
  const data = text ? JSON.parse(text) : {};

  if (!googleResponse.ok) {
    throw new Error(data.error_description ?? data.error ?? 'Google token exchange failed');
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    idToken: data.id_token,
    scope: data.scope,
    tokenType: data.token_type,
    issuedAt: Math.floor(Date.now() / 1000),
  } satisfies GoogleTokenResponse;
}
