import * as SecureStore from 'expo-secure-store';

const PENDING_GOOGLE_OAUTH_KEY = 'fitty.google_oauth_pending';
const PENDING_MAX_AGE_MS = 10 * 60 * 1000;

export type PendingGoogleOAuth = {
  state: string;
  createdAt: number;
};

const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export async function savePendingGoogleOAuth(state: string) {
  const pending: PendingGoogleOAuth = { state, createdAt: Date.now() };
  await SecureStore.setItemAsync(PENDING_GOOGLE_OAUTH_KEY, JSON.stringify(pending), STORE_OPTIONS);
}

export async function loadPendingGoogleOAuth() {
  const raw = await SecureStore.getItemAsync(PENDING_GOOGLE_OAUTH_KEY, STORE_OPTIONS);

  if (!raw) {
    return null;
  }

  try {
    const pending = JSON.parse(raw) as PendingGoogleOAuth;

    if (!pending.state || Date.now() - pending.createdAt > PENDING_MAX_AGE_MS) {
      await clearPendingGoogleOAuth();
      return null;
    }

    return pending;
  } catch {
    await clearPendingGoogleOAuth();
    return null;
  }
}

export async function clearPendingGoogleOAuth() {
  await SecureStore.deleteItemAsync(PENDING_GOOGLE_OAUTH_KEY, STORE_OPTIONS);
}
