import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LoadingDots } from '@/components/loading';
import { MetricIcon } from '@/components/metric-icon';
import { Section, SectionHeader, TextButton } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { WidgetEditor } from '@/components/widget-editor';
import { ErrorRed, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { syncGoogleHealthToAppleHealth } from '@/lib/apple-health-sync';
import { unregisterWidgetRefresh } from '@/lib/background-refresh';
import { loadDashboardPrefs, saveDashboardPrefs } from '@/lib/dashboard-prefs';
import { defaultPrefs, type DashboardPrefs } from '@/lib/dashboard-prefs-core';
import { ensureFreshToken } from '@/lib/google-auth';
import {
    fetchGoogleHealthSnapshot,
    fetchHealthMetrics,
    type GoogleTokenResponse,
} from '@/lib/google-health';
import { clearSnapshotCache, getCachedSnapshot, setCachedSnapshot } from '@/lib/health-cache';
import { getMetricDef } from '@/lib/metric-catalog';
import { clearStoredToken, loadStoredToken, saveStoredToken } from '@/lib/token-store';
import {
    WIDGET_SLOT_COLORS,
    buildWidgetData,
    emptyWidgetData,
    getWidgetMetricIds,
} from '@/lib/widget-data';
import { syncWidgets } from '@/lib/widget-sync';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';
type DashboardRangeDays = 1 | 7 | 14 | 30 | 90;

const RANGE_OPTIONS: { label: string; value: DashboardRangeDays }[] = [
  { label: 'Today', value: 1 },
  { label: '7D', value: 7 },
  { label: '14D', value: 14 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [prefs, setPrefs] = useState<DashboardPrefs>(defaultPrefs);
  const [token, setToken] = useState<GoogleTokenResponse | null>(null);
  const [restoringSession, setRestoringSession] = useState(true);
  const [accountSyncState, setAccountSyncState] = useState<LoadState>('idle');
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState<DashboardRangeDays>(1);
  const [widgetEditorOpen, setWidgetEditorOpen] = useState(false);
  const [widgetEditorSlot, setWidgetEditorSlot] = useState(0);
  const [widgetSyncState, setWidgetSyncState] = useState<LoadState>('idle');
  const [widgetSyncMessage, setWidgetSyncMessage] = useState<string | null>(null);
  const [appleHealthSyncState, setAppleHealthSyncState] = useState<LoadState>('idle');
  const [appleHealthSyncMessage, setAppleHealthSyncMessage] = useState<string | null>(null);

  const prefsRef = useRef(prefs);
  const tokenRef = useRef(token);

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    let ignore = false;

    loadDashboardPrefs()
      .then((stored) => {
        if (!ignore) {
          setPrefs(stored);
        }
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function restoreSession() {
      try {
        const stored = await loadStoredToken();

        if (!stored || ignore) {
          return;
        }

        const fresh = await ensureFreshToken(stored);

        if (ignore) {
          return;
        }

        if (fresh !== stored) {
          await saveStoredToken(fresh).catch(() => undefined);
        }

        setToken(fresh);
      } catch {
        if (!ignore) {
          setToken(null);
        }
      } finally {
        if (!ignore) {
          setRestoringSession(false);
        }
      }
    }

    restoreSession();

    return () => {
      ignore = true;
    };
  }, []);

  const persistPrefs = useCallback((next: DashboardPrefs) => {
    prefsRef.current = next;
    setPrefs(next);
    saveDashboardPrefs(next).catch(() => undefined);
  }, []);

  const refreshWidgetsForPrefs = useCallback(async (nextPrefs: DashboardPrefs) => {
    setWidgetSyncState('loading');
    setWidgetSyncMessage(null);
    const cachedMetrics = getCachedSnapshot(1)?.snapshot.metrics ?? [];

    try {
      const current = tokenRef.current;

      if (!current) {
        await syncWidgets(emptyWidgetData(nextPrefs));
        setWidgetSyncState('loaded');
        setWidgetSyncMessage('Saved');
        return;
      }

      const fresh = await ensureFreshToken(current);

      if (fresh !== current) {
        tokenRef.current = fresh;
        setToken(fresh);
        saveStoredToken(fresh).catch(() => undefined);
      }

      const { metrics } = await fetchHealthMetrics(
        fresh.accessToken,
        getWidgetMetricIds(nextPrefs, { includeConfigurable: Platform.OS === 'ios' }),
        1
      );

      await syncWidgets(buildWidgetData(nextPrefs, metrics));
      setWidgetSyncState('loaded');
      setWidgetSyncMessage('Saved');
    } catch {
      await syncWidgets(buildWidgetData(nextPrefs, cachedMetrics)).catch(() => undefined);
      setWidgetSyncState('error');
      setWidgetSyncMessage('Saved. Widget values refresh after the next dashboard sync.');
    }
  }, []);

  const selectWidgetMetric = useCallback(
    (slot: number, metricId: string) => {
      const current = prefsRef.current;

      if (current.widgetMetrics[slot] === metricId) {
        return;
      }

      const widgetMetrics = [...current.widgetMetrics] as DashboardPrefs['widgetMetrics'];
      widgetMetrics[slot] = metricId;
      const next = { ...current, widgetMetrics };

      persistPrefs(next);
      refreshWidgetsForPrefs(next).catch(() => undefined);
    },
    [persistPrefs, refreshWidgetsForPrefs]
  );

  const syncGoogleData = useCallback(async () => {
    const current = tokenRef.current;

    if (!current) {
      setAccountSyncState('error');
      setAccountMessage('Sign in with Google from the dashboard first.');
      return;
    }

    setAccountSyncState('loading');
    setAccountMessage(null);

    try {
      const fresh = await ensureFreshToken(current);

      if (fresh !== current) {
        tokenRef.current = fresh;
        setToken(fresh);
        saveStoredToken(fresh).catch(() => undefined);
      }

      const healthSnapshot = await fetchGoogleHealthSnapshot(fresh.accessToken, {
        days: 1,
        metricIds: getWidgetMetricIds(prefsRef.current, {
          includeConfigurable: Platform.OS === 'ios',
        }),
      });
      setCachedSnapshot(1, healthSnapshot);
      await syncWidgets(buildWidgetData(prefsRef.current, healthSnapshot.metrics));

      setAccountSyncState('loaded');
      setAccountMessage('Synced Google data and widgets.');
    } catch (syncError) {
      setAccountSyncState('error');
      setAccountMessage(syncError instanceof Error ? syncError.message : String(syncError));
    }
  }, []);

  const signOut = useCallback(() => {
    clearStoredToken().catch(() => undefined);
    clearSnapshotCache();
    syncWidgets(emptyWidgetData(prefsRef.current)).catch(() => undefined);
    unregisterWidgetRefresh().catch(() => undefined);
    tokenRef.current = null;
    setToken(null);
    setAccountSyncState('idle');
    setAccountMessage('Signed out.');
    router.replace('/');
  }, [router]);

  const syncToAppleHealth = useCallback(async () => {
    const current = tokenRef.current;

    if (!current) {
      setAppleHealthSyncState('error');
      setAppleHealthSyncMessage('Sign in with Google from the dashboard first.');
      return;
    }

    setAppleHealthSyncState('loading');
    setAppleHealthSyncMessage(null);

    try {
      const fresh = await ensureFreshToken(current);

      if (fresh !== current) {
        tokenRef.current = fresh;
        setToken(fresh);
        saveStoredToken(fresh).catch(() => undefined);
      }

      const result = await syncGoogleHealthToAppleHealth(fresh.accessToken, { days: rangeDays });

      setAppleHealthSyncState(result.status === 'unsupported' ? 'idle' : 'loaded');
      setAppleHealthSyncMessage(result.message);
    } catch (syncError) {
      setAppleHealthSyncState('error');
      setAppleHealthSyncMessage(syncError instanceof Error ? syncError.message : String(syncError));
    }
  }, [rangeDays]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerBackTitle: 'Home',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
      >
      <View style={styles.container}>
        <Section index={0}>
          <ThemedText type="title">Settings</ThemedText>
        </Section>

        <Section index={1}>
          <SectionHeader
            title="Account"
            trailing={
              accountSyncState === 'loading' || restoringSession ? (
                <LoadingDots color={theme.textSecondary} />
              ) : (
                <TextButton
                  label="Sync"
                  color={theme.text}
                  onPress={syncGoogleData}
                  disabled={!token}
                />
              )
            }
          />
          <View style={[styles.accountCard, { backgroundColor: theme.card }]}>
            <View style={styles.accountCopy}>
              <ThemedText type="smallBold">Google account</ThemedText>
              <ThemedText
                type="small"
                style={{ color: accountSyncState === 'error' ? ErrorRed : theme.textSecondary }}
              >
                {accountMessage ?? (token ? 'Connected' : 'Not signed in')}
              </ThemedText>
            </View>
            <TextButton
              label="Sign out"
              color={theme.textSecondary}
              onPress={signOut}
              disabled={!token}
            />
          </View>
        </Section>

        <Section index={2}>
          <SectionHeader
            title="Widgets"
            trailing={
              widgetSyncState === 'loading' ? (
                <LoadingDots color={theme.textSecondary} />
              ) : (
                <TextButton
                  label="Edit"
                  color={theme.text}
                  onPress={() => {
                    setWidgetEditorSlot(0);
                    setWidgetEditorOpen(true);
                  }}
                />
              )
            }
          />
          <View style={[styles.widgetsCard, { backgroundColor: theme.card }]}>
            {prefs.widgetMetrics.map((id, i) => {
              const def = getMetricDef(id);

              return (
                <Pressable
                  key={`${i}-${id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${def?.label ?? id} widget metric`}
                  onPress={() => {
                    setWidgetEditorSlot(i);
                    setWidgetEditorOpen(true);
                  }}
                  style={({ pressed }) => [
                    styles.widgetMetricPill,
                    { backgroundColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}
                >
                  {def ? (
                    <MetricIcon
                      icon={def.icon}
                      glyph={def.glyph}
                      size={16}
                      color={WIDGET_SLOT_COLORS[i]}
                    />
                  ) : null}
                  <View style={styles.widgetMetricText}>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {i === 0 ? 'Single' : i === 1 ? 'Double' : 'Triple'}
                    </ThemedText>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {def?.shortLabel ?? def?.label ?? id}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {widgetSyncMessage ? (
            <ThemedText
              type="small"
              style={{ color: widgetSyncState === 'error' ? ErrorRed : theme.textSecondary }}
            >
              {widgetSyncMessage}
            </ThemedText>
          ) : null}
        </Section>

        {Platform.OS === 'ios' && (
          <Section index={3}>
            <SectionHeader
              title="Apple Health"
              trailing={
                appleHealthSyncState === 'loading' || restoringSession ? (
                  <LoadingDots color={theme.textSecondary} />
                ) : (
                  <TextButton
                    label="Export"
                    color={theme.text}
                    onPress={syncToAppleHealth}
                    disabled={!token}
                  />
                )
              }
            />
            <View style={[styles.appleHealthCard, { backgroundColor: theme.card }]}>
              <View style={[styles.segments, { backgroundColor: theme.backgroundSelected }]}>
                {RANGE_OPTIONS.map((option) => {
                  const active = rangeDays === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      disabled={appleHealthSyncState === 'loading'}
                      onPress={() => setRangeDays(option.value)}
                      style={({ pressed }) => [
                        styles.segment,
                        active && { backgroundColor: theme.text },
                        pressed && styles.pressed,
                      ]}
                    >
                      <ThemedText
                        type="smallBold"
                        style={{ color: active ? theme.background : theme.textSecondary }}
                      >
                        {option.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.appleHealthCopy}>
                <ThemedText type="smallBold">Google to Apple Health</ThemedText>
                <ThemedText
                  type="small"
                  style={{
                    color: appleHealthSyncState === 'error' ? ErrorRed : theme.textSecondary,
                  }}
                >
                  {appleHealthSyncMessage ??
                    (token
                      ? 'Weight, sleep, and workouts'
                      : 'Sign in with Google from the dashboard first.')}
                </ThemedText>
              </View>
            </View>
          </Section>
        )}

        <Section index={Platform.OS === 'ios' ? 4 : 3}>
          <SectionHeader title="Experimental" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Fitbit Bluetooth lab"
            onPress={() => router.push('/fitbit-ble')}
            style={({ pressed }) => [
              styles.bluetoothCard,
              { backgroundColor: theme.card },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.bluetoothCopy}>
              <ThemedText type="smallBold">Fitbit Bluetooth</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Inspect BLE services on already-connected devices.
              </ThemedText>
            </View>
          </Pressable>
        </Section>

        <WidgetEditor
          visible={widgetEditorOpen}
          slots={prefs.widgetMetrics}
          editingSlot={widgetEditorSlot}
          onEditSlot={setWidgetEditorSlot}
          onSelect={selectWidgetMetric}
          onClose={() => setWidgetEditorOpen(false)}
        />
      </View>
      </ScrollView>
    </>
  );
}

const RADIUS = 12;

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    paddingTop: Spacing.four,
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  accountCopy: {
    minWidth: 0,
    flex: 1,
    gap: Spacing.half,
  },
  widgetsCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  widgetMetricPill: {
    minWidth: 0,
    flexGrow: 1,
    flexBasis: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 8,
    borderCurve: 'continuous',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  widgetMetricText: {
    minWidth: 0,
    flex: 1,
    gap: Spacing.half,
  },
  appleHealthCard: {
    gap: Spacing.three,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  appleHealthCopy: {
    gap: Spacing.half,
  },
  bluetoothCard: {
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  bluetoothCopy: {
    gap: Spacing.half,
  },
  segments: {
    flexDirection: 'row',
    borderRadius: 9,
    borderCurve: 'continuous',
    padding: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: 7,
    borderCurve: 'continuous',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
