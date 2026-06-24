import * as SecureStore from 'expo-secure-store';

import type { WidgetData } from '@/lib/widget-data';

/**
 * Persists the last synced widget data so headless renders (Android's widget
 * task handler, OS-driven refreshes) can draw without touching the network.
 * AFTER_FIRST_UNLOCK keeps the entry readable from background tasks.
 */

const WIDGET_DATA_KEY = 'fitty.widget_data';

const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export async function saveLastWidgetData(data: WidgetData) {
  await SecureStore.setItemAsync(WIDGET_DATA_KEY, JSON.stringify(data), STORE_OPTIONS);
}

export async function loadLastWidgetData(): Promise<WidgetData | null> {
  try {
    const raw = await SecureStore.getItemAsync(WIDGET_DATA_KEY, STORE_OPTIONS);
    return raw ? (JSON.parse(raw) as WidgetData) : null;
  } catch {
    return null;
  }
}
