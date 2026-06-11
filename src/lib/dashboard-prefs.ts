import * as SecureStore from 'expo-secure-store';

import {
  decodePrefs,
  LEGACY_GREEN_RING_KEY,
  PREFS_KEY,
  type DashboardPrefs,
} from '@/lib/dashboard-prefs-core';

/**
 * Persists dashboard customization (rings, goals, cards) across restarts.
 * SecureStore is overkill for non-secrets, but it is the storage primitive
 * already in the app and the payload is tiny.
 */

export async function loadDashboardPrefs(): Promise<DashboardPrefs> {
  const [raw, legacy] = await Promise.all([
    SecureStore.getItemAsync(PREFS_KEY),
    SecureStore.getItemAsync(LEGACY_GREEN_RING_KEY),
  ]);

  const prefs = decodePrefs(raw, legacy);

  if (!raw && legacy) {
    await saveDashboardPrefs(prefs).catch(() => undefined);
  }

  if (legacy) {
    await SecureStore.deleteItemAsync(LEGACY_GREEN_RING_KEY).catch(() => undefined);
  }

  return prefs;
}

export async function saveDashboardPrefs(prefs: DashboardPrefs) {
  await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs));
}
