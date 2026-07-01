import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { LoadingDots } from '@/components/loading';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { defaultPrefs, type DashboardPrefs } from '@/lib/dashboard-prefs-core';
import { setCachedSnapshot } from '@/lib/health-cache';
import { saveDashboardPrefs } from '@/lib/dashboard-prefs';
import type { HealthMetric, HealthSnapshot, SleepSummary } from '@/lib/google-health';
import { saveStoredToken } from '@/lib/token-store';
import { buildWidgetData } from '@/lib/widget-data';
import { syncWidgets } from '@/lib/widget-sync';

const ENABLE_ANDROID_DASHBOARD_FIXTURE =
  Platform.OS === 'android' &&
  (__DEV__ || process.env.EXPO_PUBLIC_ENABLE_ANDROID_DASHBOARD_FIXTURE === '1');

const FIXTURE_ID_TOKEN =
  'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJnaXZlbl9uYW1lIjoiQW5kcm9pZCIsIm5hbWUiOiJBbmRyb2lkIFRlc3RlciIsImVtYWlsIjoiYW5kcm9pZC5maXh0dXJlQGV4YW1wbGUudGVzdCJ9.fixture';

const RANGE_DAYS = [1, 7, 14, 30, 90] as const;

function metric(id: string, label: string, value: number | null, unit: string): HealthMetric {
  return {
    id,
    label,
    value,
    unit,
    status: value === null ? 'empty' : 'loaded',
  };
}

function dayOffset(daysAgo: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function buildPrefs(): DashboardPrefs {
  return {
    ...defaultPrefs(),
    rings: ['steps', 'active-energy-burned', 'active-minutes'],
    widgetMetrics: ['steps', 'active-energy-burned', 'active-minutes'],
    cards: [
      'sleep',
      'steps',
      'active-energy-burned',
      'active-minutes',
      'total-calories',
      'heart-rate',
      'daily-resting-heart-rate',
      'distance',
      'weight',
      'nutrition-log',
    ],
  };
}

function buildSleepSessions(days: number): SleepSummary[] {
  return [
    {
      id: `fixture-sleep-${days}`,
      kind: 'sleep',
      startTime: dayOffset(1, 22, 45),
      endTime: dayOffset(0, 6, 38),
      minutesAsleep: 448,
      minutesInSleepPeriod: 473,
    },
    {
      id: `fixture-nap-${days}`,
      kind: 'nap',
      startTime: dayOffset(0, 14, 5),
      endTime: dayOffset(0, 14, 31),
      minutesAsleep: 24,
      minutesInSleepPeriod: 26,
    },
  ];
}

function buildSnapshot(days: number): HealthSnapshot {
  const multiplier = days === 1 ? 1 : days * 0.9;
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  const rangeLabel =
    days === 1
      ? 'Today'
      : `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  const metrics = [
    metric('steps', 'Steps', Math.round(11842 * multiplier), 'steps'),
    metric('active-energy-burned', 'Active calories', Math.round(615 * multiplier), 'kcal'),
    metric('active-minutes', 'Active minutes', Math.round(52 * multiplier), 'min'),
    metric('total-calories', 'Total calories', Math.round(2420 * multiplier), 'kcal'),
    metric('heart-rate', 'Avg heart rate', 73, 'bpm'),
    metric('daily-resting-heart-rate', 'Resting heart rate', 58, 'bpm'),
    metric('distance', 'Distance', Number((7.42 * multiplier).toFixed(1)), 'km'),
    metric('weight', 'Weight', 72.4, 'kg'),
    metric('nutrition-log', 'Nutrition', Math.round(1900 * multiplier), 'kcal'),
  ];

  return {
    identity: { fixture: true },
    profile: { displayName: 'Android Tester' },
    metrics,
    exercises: [
      {
        id: `fixture-run-${days}`,
        name: 'Morning run',
        type: 'RUNNING',
        startTime: dayOffset(0, 7, 12),
        endTime: dayOffset(0, 7, 48),
        activeMinutes: 36,
        caloriesKcal: 385,
        distanceKm: 5.8,
        steps: 6280,
      },
    ],
    sleepSessions: buildSleepSessions(days),
    rangeLabel,
    raw: {
      rollups: {},
      exercises: {},
      sleep: {},
      identity: {},
      profile: {},
    },
  };
}

async function seedFixture() {
  const prefs = buildPrefs();
  await saveDashboardPrefs(prefs);
  await saveStoredToken({
    accessToken: 'android-dashboard-fixture-access-token',
    expiresIn: 60 * 60,
    idToken: FIXTURE_ID_TOKEN,
    refreshToken: 'android-dashboard-fixture-refresh-token',
    scope: 'fixture',
    tokenType: 'Bearer',
    issuedAt: Math.floor(Date.now() / 1000),
  });

  let todaySnapshot: HealthSnapshot | null = null;
  for (const days of RANGE_DAYS) {
    const snapshot = buildSnapshot(days);
    setCachedSnapshot(days, snapshot);
    if (days === 1) {
      todaySnapshot = snapshot;
    }
  }

  if (todaySnapshot) {
    await syncWidgets(buildWidgetData(prefs, todaySnapshot.metrics)).catch(() => undefined);
  }
}

export default function AndroidDashboardFixture() {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ENABLE_ANDROID_DASHBOARD_FIXTURE) {
      return;
    }

    let cancelled = false;

    seedFixture()
      .then(() => {
        if (!cancelled) {
          router.replace('/');
        }
      })
      .catch((fixtureError) => {
        if (!cancelled) {
          setError(fixtureError instanceof Error ? fixtureError.message : String(fixtureError));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ENABLE_ANDROID_DASHBOARD_FIXTURE) {
    return <Redirect href="/" />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {error ? (
        <>
          <ThemedText type="subtitle">Android fixture failed</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'center' }}>
            {error}
          </ThemedText>
        </>
      ) : (
        <>
          <LoadingDots color={theme.textSecondary} size={8} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Preparing dashboard fixture
          </ThemedText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
});
