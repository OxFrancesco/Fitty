import * as SecureStore from 'expo-secure-store';

import type { GoogleTokenResponse } from '@/lib/google-health';

/**
 * Persists the Google session in the device keychain/keystore so sign-in
 * survives app restarts. SecureStore values should stay under ~2 KB and the
 * Google ID token (a JWT) can approach that alone, so it gets its own entry.
 */

const TOKEN_KEY = 'fitty.google_token';
const ID_TOKEN_KEY = 'fitty.google_id_token';

export async function saveStoredToken(token: GoogleTokenResponse) {
  const { idToken, ...rest } = token;

  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(rest));

  if (idToken) {
    await SecureStore.setItemAsync(ID_TOKEN_KEY, idToken);
  } else {
    await SecureStore.deleteItemAsync(ID_TOKEN_KEY);
  }
}

export async function loadStoredToken(): Promise<GoogleTokenResponse | null> {
  const raw = await SecureStore.getItemAsync(TOKEN_KEY);

  if (!raw) {
    return null;
  }

  try {
    const token = JSON.parse(raw) as GoogleTokenResponse;
    const idToken = await SecureStore.getItemAsync(ID_TOKEN_KEY);
    return idToken ? { ...token, idToken } : token;
  } catch {
    await clearStoredToken();
    return null;
  }
}

export async function clearStoredToken() {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(ID_TOKEN_KEY),
  ]);
}
