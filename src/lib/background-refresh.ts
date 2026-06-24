import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { loadDashboardPrefs } from '@/lib/dashboard-prefs';
import { ensureFreshToken, isAccessTokenFresh } from '@/lib/google-auth';
import { fetchHealthMetrics } from '@/lib/google-health';
import { loadStoredToken, saveStoredToken } from '@/lib/token-store';
import { buildWidgetData, getWidgetMetricIds } from '@/lib/widget-data';
import { syncWidgets } from '@/lib/widget-sync';

/**
 * Periodically refetches today's ring metrics and pushes them to the
 * home-screen widgets while the app is backgrounded. The OS decides the
 * actual cadence; every foreground open re-syncs immediately regardless.
 */

export const WIDGET_REFRESH_TASK = 'fitty-widget-refresh';

if (Platform.OS !== 'web') {
  // Must run in global scope so the task survives headless launches.
  TaskManager.defineTask(WIDGET_REFRESH_TASK, async () => {
    try {
      const stored = await loadStoredToken();
      if (!stored) {
        // Signed out — nothing to refresh.
        return BackgroundTask.BackgroundTaskResult.Success;
      }

      let token = stored;
      if (!isAccessTokenFresh(stored)) {
        try {
          token = await ensureFreshToken(stored);
          await saveStoredToken(token).catch(() => undefined);
        } catch {
          // Refresh failed (revoked session or unreachable API server).
          // Skip silently; the foreground app handles re-auth.
          return BackgroundTask.BackgroundTaskResult.Success;
        }
      }

      const prefs = await loadDashboardPrefs();
      const { metrics } = await fetchHealthMetrics(
        token.accessToken,
        getWidgetMetricIds(prefs, { includeConfigurable: Platform.OS === 'ios' }),
        1
      );
      await syncWidgets(buildWidgetData(prefs, metrics));
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerWidgetRefresh() {
  if (Platform.OS === 'web') {
    return;
  }

  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
    return;
  }

  // Minutes; the OS treats it as a floor, not a schedule.
  await BackgroundTask.registerTaskAsync(WIDGET_REFRESH_TASK, { minimumInterval: 30 });
}

export async function unregisterWidgetRefresh() {
  if (Platform.OS === 'web') {
    return;
  }

  await BackgroundTask.unregisterTaskAsync(WIDGET_REFRESH_TASK).catch(() => undefined);
}
