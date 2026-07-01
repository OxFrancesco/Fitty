const PENDING_GOOGLE_OAUTH_KEY = 'fitty.google_oauth_pending';
const PENDING_MAX_AGE_MS = 10 * 60 * 1000;

export type PendingGoogleOAuth = {
  state: string;
  createdAt: number;
};

export async function savePendingGoogleOAuth(state: string) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const pending: PendingGoogleOAuth = { state, createdAt: Date.now() };
  localStorage.setItem(PENDING_GOOGLE_OAUTH_KEY, JSON.stringify(pending));
}

export async function loadPendingGoogleOAuth() {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  const raw = localStorage.getItem(PENDING_GOOGLE_OAUTH_KEY);

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
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(PENDING_GOOGLE_OAUTH_KEY);
  }
}
