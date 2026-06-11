import {
  decodePrefs,
  LEGACY_GREEN_RING_KEY,
  PREFS_KEY,
  type DashboardPrefs,
} from '@/lib/dashboard-prefs-core';

/** Web counterpart of dashboard-prefs.ts — SecureStore is unavailable in browsers. */

export async function loadDashboardPrefs(): Promise<DashboardPrefs> {
  if (typeof localStorage === 'undefined') {
    return decodePrefs(null, null);
  }

  const raw = localStorage.getItem(PREFS_KEY);
  const legacy = localStorage.getItem(LEGACY_GREEN_RING_KEY);
  const prefs = decodePrefs(raw, legacy);

  if (!raw && legacy) {
    await saveDashboardPrefs(prefs).catch(() => undefined);
  }

  if (legacy) {
    localStorage.removeItem(LEGACY_GREEN_RING_KEY);
  }

  return prefs;
}

export async function saveDashboardPrefs(prefs: DashboardPrefs) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
