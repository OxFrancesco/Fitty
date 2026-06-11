import * as ExpoCrypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { ActivityRings, type RingSlot } from '@/components/activity-rings';
import { CardEditor } from '@/components/card-editor';
import { LoadingDots, SkeletonCard } from '@/components/loading';
import { MetricCard } from '@/components/metric-card';
import { SleepCard } from '@/components/sleep-card';
import { ThemedText } from '@/components/themed-text';
import { ErrorRed, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchApiJson, getApiBaseUrl } from '@/lib/api-base';
import { DEBUG_ENABLED } from '@/lib/debug';
import { ensureFreshToken } from '@/lib/google-auth';
import {
  clearSnapshotCache,
  getCachedSnapshot,
  isSnapshotFresh,
  setCachedSnapshot,
} from '@/lib/health-cache';
import { loadDashboardPrefs, saveDashboardPrefs } from '@/lib/dashboard-prefs';
import { defaultPrefs, type DashboardPrefs } from '@/lib/dashboard-prefs-core';
import { getDefaultGoal, getMetricDef, SLEEP_CARD_ID } from '@/lib/metric-catalog';
import { clearStoredToken, loadStoredToken, saveStoredToken } from '@/lib/token-store';
import {
  fetchGoogleHealthSnapshot,
  fetchHealthMetrics,
  GOOGLE_HEALTH_SCOPES,
  GOOGLE_OAUTH_DISCOVERY,
  mergeSnapshotMetrics,
  type GoogleHealthConfig,
  type GoogleTokenResponse,
  type HealthMetric,
  type HealthSnapshot,
} from '@/lib/google-health';

WebBrowser.maybeCompleteAuthSession();

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';
type DashboardRangeDays = 1 | 7 | 14 | 30 | 90;

const GOOGLE_NATIVE_REDIRECT_URI = 'com.francescooddo.fitty:/oauth';
const RANGE_OPTIONS: { label: string; value: DashboardRangeDays }[] = [
  { label: 'Today', value: 1 },
  { label: '7D', value: 7 },
  { label: '14D', value: 14 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
];

function createOAuthState(appReturnUri: string) {
  return `${ExpoCrypto.randomUUID()}.${encodeURIComponent(appReturnUri)}`;
}

function buildGoogleAuthUrl(config: GoogleHealthConfig, state: string) {
  const url = new URL(GOOGLE_OAUTH_DISCOVERY.authorizationEndpoint);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_HEALTH_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);

  if (Platform.OS === 'web') {
    url.searchParams.set('include_granted_scopes', 'true');
  }

  return url.toString();
}

export default function HomeScreen() {
  const theme = useTheme();
  const [config, setConfig] = useState<GoogleHealthConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [token, setToken] = useState<GoogleTokenResponse | null>(null);
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [authState, setAuthState] = useState<LoadState>('idle');
  const [healthState, setHealthState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState<DashboardRangeDays>(1);
  const [prefs, setPrefs] = useState<DashboardPrefs>(defaultPrefs);
  const [cardEditorOpen, setCardEditorOpen] = useState(false);
  const [ringEditorSlot, setRingEditorSlot] = useState<number | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [restoring, setRestoring] = useState(true);
  // True while revalidating in the background — cached data stays on screen.
  const [refreshing, setRefreshing] = useState(false);
  // Guards against an older fetch overwriting a newer range's data.
  const requestIdRef = useRef(0);
  const snapshotRef = useRef<HealthSnapshot | null>(null);

  // Latest prefs for callbacks that must not capture stale state.
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  // Metrics the dashboard needs: every ring plus every visible metric card.
  const neededIds = useMemo(() => {
    const ids = new Set<string>();

    for (const id of [...prefs.rings, ...prefs.cards]) {
      if (id !== SLEEP_CARD_ID && getMetricDef(id)) {
        ids.add(id);
      }
    }

    return [...ids];
  }, [prefs.rings, prefs.cards]);

  const neededIdsRef = useRef(neededIds);
  useEffect(() => {
    neededIdsRef.current = neededIds;
  }, [neededIds]);

  const applySnapshot = useCallback((next: HealthSnapshot | null) => {
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadConfig() {
      try {
        const data = await fetchApiJson<GoogleHealthConfig>(`/api/google/config?platform=${Platform.OS}`);

        if (!ignore) {
          setConfig(data);
        }
      } catch (loadError) {
        if (!ignore) {
          setConfigError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      }
    }

    loadConfig();

    return () => {
      ignore = true;
    };
  }, []);

  // Restore persisted dashboard customization (rings, goals, cards).
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

  const persistPrefs = useCallback((next: DashboardPrefs) => {
    setPrefs(next);
    saveDashboardPrefs(next).catch(() => undefined);
  }, []);

  const selectRingMetric = useCallback(
    (slot: number, metricId: string) => {
      const rings = [...prefsRef.current.rings] as DashboardPrefs['rings'];
      rings[slot] = metricId;
      persistPrefs({ ...prefsRef.current, rings });
    },
    [persistPrefs]
  );

  const changeRingGoal = useCallback(
    (metricId: string, goal: number) => {
      persistPrefs({
        ...prefsRef.current,
        goals: { ...prefsRef.current.goals, [metricId]: goal },
      });
    },
    [persistPrefs]
  );

  const toggleCard = useCallback(
    (id: string) => {
      const current = prefsRef.current;
      const cards = current.cards.includes(id)
        ? current.cards.filter((card) => card !== id)
        : [...current.cards, id];
      persistPrefs({ ...current, cards });
    },
    [persistPrefs]
  );

  const loadHealthData = useCallback(
    async (accessToken: string, days: DashboardRangeDays, options?: { force?: boolean }) => {
      const requestId = ++requestIdRef.current;
      const cached = getCachedSnapshot(days);
      setError(null);

      if (cached) {
        // Instant: render the cached snapshot immediately.
        applySnapshot(cached.snapshot);
        setHealthState('loaded');

        if (!options?.force && isSnapshotFresh(cached)) {
          // A fresh cache may still miss metrics added to rings/cards since.
          const missing = neededIdsRef.current.filter(
            (id) => !cached.snapshot.metrics.some((metric) => metric.id === id)
          );

          if (!missing.length) {
            // Cancels any superseded in-flight refresh's indicator too.
            setRefreshing(false);
            return;
          }

          setRefreshing(true);

          try {
            const { metrics, raw } = await fetchHealthMetrics(accessToken, missing, days);

            if (requestIdRef.current === requestId) {
              const merged = mergeSnapshotMetrics(
                snapshotRef.current ?? cached.snapshot,
                metrics,
                raw
              );
              setCachedSnapshot(days, merged);
              applySnapshot(merged);
            }
          } catch {
            // Top-up failed — the cached snapshot stays on screen.
          } finally {
            if (requestIdRef.current === requestId) {
              setRefreshing(false);
            }
          }

          return;
        }
      }

      // With anything on screen we revalidate silently; otherwise it's a first load.
      const background = cached !== null || snapshotRef.current !== null;

      if (background) {
        setRefreshing(true);
      } else {
        setHealthState('loading');
      }

      try {
        const healthSnapshot = await fetchGoogleHealthSnapshot(accessToken, {
          days,
          metricIds: neededIdsRef.current,
        });
        setCachedSnapshot(days, healthSnapshot);

        if (requestIdRef.current === requestId) {
          applySnapshot(healthSnapshot);
          setHealthState('loaded');
        }
      } catch (loadError) {
        if (requestIdRef.current === requestId) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
          if (!background) {
            setHealthState('error');
          }
        }
      } finally {
        if (background && requestIdRef.current === requestId) {
          setRefreshing(false);
        }
      }
    },
    [applySnapshot]
  );

  // Restore a persisted session so sign-in survives app restarts.
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
          await saveStoredToken(fresh);
        }

        setToken(fresh);
        setAuthState('loaded');
        loadHealthData(fresh.accessToken, 1);
      } catch {
        // Stored session can no longer be refreshed — require a new sign-in.
        await clearStoredToken().catch(() => undefined);
      } finally {
        if (!ignore) {
          setRestoring(false);
        }
      }
    }

    restoreSession();

    return () => {
      ignore = true;
    };
  }, [loadHealthData]);

  const startGoogleSignIn = useCallback(async () => {
    if (!config?.clientId || !config.hasClientSecret || !config.redirectUri || !config.appReturnUri) {
      setError('Google OAuth is not ready. Check .env.local and restart Expo.');
      return;
    }

    setAuthState('loading');
    setError(null);

    try {
      const appReturnUri = config.appReturnUri || GOOGLE_NATIVE_REDIRECT_URI;
      const state = createOAuthState(appReturnUri);
      const result = await WebBrowser.openAuthSessionAsync(
        buildGoogleAuthUrl(config, state),
        appReturnUri
      );

      if (result.type !== 'success') {
        setAuthState(token ? 'loaded' : 'idle');
        return;
      }

      const returnUrl = new URL(result.url);
      const returnedState = returnUrl.searchParams.get('state');
      const oauthError = returnUrl.searchParams.get('error');

      if (oauthError) {
        throw new Error(oauthError);
      }

      if (returnedState !== state) {
        throw new Error('Google OAuth state did not match. Try signing in again.');
      }

      const nextToken = await fetchApiJson<GoogleTokenResponse>(
        `/api/google/session?state=${encodeURIComponent(state)}`
      );
      // A fresh sign-in may be a different account — drop any cached data.
      clearSnapshotCache();
      setToken(nextToken);
      setAuthState('loaded');
      await saveStoredToken(nextToken).catch(() => undefined);
      await loadHealthData(nextToken.accessToken, rangeDays);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : String(signInError));
      setAuthState('error');
    }
  }, [config, loadHealthData, rangeDays, token]);

  // Refreshes the access token when it is about to expire, then loads data.
  const loadWithFreshToken = useCallback(
    async (days: DashboardRangeDays, options?: { force?: boolean }) => {
      if (!token) {
        return;
      }

      let current = token;

      try {
        current = await ensureFreshToken(token);
      } catch (refreshError) {
        // Refresh token revoked or expired — force a new sign-in.
        await clearStoredToken().catch(() => undefined);
        clearSnapshotCache();
        setToken(null);
        applySnapshot(null);
        setRefreshing(false);
        setAuthState('idle');
        setHealthState('idle');
        setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
        return;
      }

      if (current !== token) {
        setToken(current);
        saveStoredToken(current).catch(() => undefined);
      }

      loadHealthData(current.accessToken, days, options);
    },
    [applySnapshot, loadHealthData, token]
  );

  const refreshHealthData = useCallback(() => {
    loadWithFreshToken(rangeDays, { force: true });
  }, [loadWithFreshToken, rangeDays]);

  // When customization adds a metric we have not fetched yet, top up the
  // current snapshot in the background instead of reloading everything.
  useEffect(() => {
    const current = snapshotRef.current;

    if (!token || !current) {
      return;
    }

    const missing = neededIds.filter(
      (id) => !current.metrics.some((metric) => metric.id === id)
    );

    if (!missing.length) {
      return;
    }

    let cancelled = false;

    (async () => {
      setRefreshing(true);

      try {
        const fresh = await ensureFreshToken(token);
        const { metrics, raw } = await fetchHealthMetrics(fresh.accessToken, missing, rangeDays);
        const base = snapshotRef.current;

        if (cancelled || !base) {
          return;
        }

        const merged = mergeSnapshotMetrics(base, metrics, raw);
        setCachedSnapshot(rangeDays, merged);
        applySnapshot(merged);
      } catch {
        // New metrics stay '--' until the next sync.
      } finally {
        if (!cancelled) {
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applySnapshot, neededIds, rangeDays, token]);

  const updateRangeDays = useCallback(
    (days: DashboardRangeDays) => {
      setRangeDays(days);
      loadWithFreshToken(days);
    },
    [loadWithFreshToken]
  );

  const signOut = useCallback(() => {
    clearStoredToken().catch(() => undefined);
    clearSnapshotCache();
    setToken(null);
    applySnapshot(null);
    setRefreshing(false);
    setError(null);
    setAuthState('idle');
    setHealthState('idle');
  }, [applySnapshot]);

  const canLogin = Boolean(config?.clientId && config.hasClientSecret && config.redirectUri && config.appReturnUri);

  // First-ever load — nothing cached yet, so show skeleton cards.
  const initialLoading = healthState === 'loading' && !snapshot;

  const metricsMap = useMemo(() => {
    const map: Record<string, HealthMetric> = {};
    for (const m of snapshot?.metrics ?? []) {
      map[m.id] = m;
    }
    return map;
  }, [snapshot?.metrics]);

  const ringSlots: RingSlot[] = useMemo(
    () =>
      prefs.rings.map((id) => ({
        metricId: id,
        value: metricsMap[id]?.value ?? null,
        goal: prefs.goals[id] ?? getDefaultGoal(id),
      })),
    [prefs.rings, prefs.goals, metricsMap]
  );

  const userName = useMemo(() => {
    if (token?.idToken) {
      const decoded = decodeIdToken(token.idToken);
      return decoded?.given_name ?? decoded?.name ?? 'User';
    }
    return 'User';
  }, [token]);

  // Greeting — time-aware
  const hour = new Date().getHours();
  const daypart = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const greeting = userName === 'User' ? `Good ${daypart}` : `Good ${daypart}, ${userName}`;
  const todayStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // ── Auth gate: sign-in screen when not authenticated ──
  if (!token) {
    // Avoid flashing the sign-in screen while the stored session restores.
    if (restoring) {
      return (
        <View style={[styles.signInScreen, { backgroundColor: theme.background }]}>
          <LoadingDots color={theme.textSecondary} size={8} />
        </View>
      );
    }

    return (
      <View style={[styles.signInScreen, { backgroundColor: theme.background }]}>
        <View style={styles.signInContent}>
          <ThemedText type="hero">OpenFit</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Connects to Google Fit
          </ThemedText>

          {error && <ErrorBanner message={error} />}

          {authState === 'loading' ? (
            <View style={styles.signInLoading}>
              <LoadingDots color={theme.textSecondary} size={8} />
            </View>
          ) : (
            <ActionButton label="Sign in with Google" disabled={!canLogin} onPress={startGoogleSignIn} />
          )}

          {DEBUG_ENABLED && (
            <DebugPanel
              expanded={showDebug}
              onToggle={() => setShowDebug((v) => !v)}
              items={[
                { label: 'API server', value: getApiBaseUrl() },
                { label: 'Redirect URI', value: config?.redirectUri ?? 'Loading' },
                { label: 'Callback URI', value: config?.appReturnUri ?? GOOGLE_NATIVE_REDIRECT_URI },
                { label: 'OAuth client', value: config?.clientId ? 'Configured' : configError ?? 'Loading' },
                { label: 'Client secret', value: config?.hasClientSecret ? 'Server only' : 'Missing' },
              ]}
            />
          )}
        </View>
      </View>
    );
  }

  // ── Authenticated dashboard ──
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.container}>
        {/* ── Header ── */}
        <Section index={0}>
          <View style={styles.headerBlock}>
            <View style={styles.headerTopRow}>
              <ThemedText type="smallBold" style={[styles.dateLabel, { color: theme.textSecondary }]}>
                {todayStr}
              </ThemedText>
              <View style={styles.headerButtons}>
                {refreshing ? (
                  <LoadingDots color={theme.textSecondary} />
                ) : (
                  <TextButton
                    label="Sync"
                    color={theme.text}
                    onPress={refreshHealthData}
                    disabled={healthState === 'loading'}
                  />
                )}
                <TextButton label="Sign out" color={theme.textSecondary} onPress={signOut} />
              </View>
            </View>
            <ThemedText type="title">{greeting}</ThemedText>
          </View>
        </Section>

        {error && <ErrorBanner message={error} />}

        {/* ── Range segmented control ── */}
        <Section index={1}>
          <View style={[styles.segments, { backgroundColor: theme.backgroundSelected }]}>
            {RANGE_OPTIONS.map((option) => {
              const active = rangeDays === option.value;
              return (
                <Pressable
                  key={option.value}
                  disabled={initialLoading}
                  onPress={() => updateRangeDays(option.value)}
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
        </Section>

        {/* ── Activity rings ── */}
        <Section index={2}>
          <SectionHeader
            title="Activity"
            trailing={
              <TextButton label="Edit" color={theme.text} onPress={() => setRingEditorSlot(0)} />
            }
          />
          <View style={[styles.ringsCard, { backgroundColor: theme.card }]}>
            <ActivityRings
              slots={ringSlots}
              editingSlot={ringEditorSlot}
              onEditSlot={setRingEditorSlot}
              onSelectMetric={selectRingMetric}
              onChangeGoal={changeRingGoal}
            />
          </View>
        </Section>

        {/* ── Metrics (user-curated cards) ── */}
        <Section index={3}>
          <SectionHeader
            title="Metrics"
            trailing={
              <TextButton label="Edit" color={theme.text} onPress={() => setCardEditorOpen(true)} />
            }
          />
          {initialLoading ? (
            <View style={styles.metricGrid}>
              {[0, 1, 2, 3].map((slot) => (
                <SkeletonCard key={slot} />
              ))}
            </View>
          ) : prefs.cards.length === 0 ? (
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, textAlign: 'center' }}
            >
              No cards yet — tap Edit to add some.
            </ThemedText>
          ) : (
            <View style={styles.metricGrid}>
              {prefs.cards.map((id) => {
                if (id === SLEEP_CARD_ID) {
                  return (
                    <Animated.View
                      key={id}
                      entering={FadeInDown.duration(350)}
                      exiting={FadeOut.duration(200)}
                      layout={LinearTransition.springify().damping(18)}
                      style={styles.sleepSlot}
                    >
                      <SleepCard sessions={snapshot?.sleepSessions ?? []} />
                    </Animated.View>
                  );
                }

                const def = getMetricDef(id);
                return def ? <MetricCard key={id} def={def} metric={metricsMap[id]} /> : null;
              })}
            </View>
          )}
        </Section>

        <CardEditor
          visible={cardEditorOpen}
          selected={prefs.cards}
          onToggle={toggleCard}
          onClose={() => setCardEditorOpen(false)}
        />

        {/* ── Connection diagnostics (debug builds only) ── */}
        {DEBUG_ENABLED && (
          <DebugPanel
            expanded={showDebug}
            onToggle={() => setShowDebug((v) => !v)}
            items={[
              { label: 'Status', value: 'Connected' },
              { label: 'API server', value: getApiBaseUrl() },
              { label: 'Redirect URI', value: config?.redirectUri ?? 'Loading' },
              { label: 'Callback URI', value: config?.appReturnUri ?? GOOGLE_NATIVE_REDIRECT_URI },
              { label: 'OAuth client', value: config?.clientId ? 'Configured' : configError ?? 'Loading' },
              { label: 'Client secret', value: config?.hasClientSecret ? 'Server only' : 'Missing' },
              { label: 'Range', value: snapshot?.rangeLabel ?? `Last ${rangeDays} days` },
            ]}
          />
        )}
      </View>
    </ScrollView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

/** Staggered entrance for dashboard sections — one orchestrated page load. */
function Section({ index, children }: { index: number; children: ReactNode }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(450).delay(index * 70)}
      style={{ gap: Spacing.three }}
    >
      {children}
    </Animated.View>
  );
}

function SectionHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="subtitle">{title}</ThemedText>
      {trailing}
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: theme.text },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <ThemedText type="default" style={{ color: theme.background, fontWeight: 600 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function TextButton({
  label,
  onPress,
  disabled,
  color,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  color: string;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function DebugPanel({
  expanded,
  onToggle,
  items,
}: {
  expanded: boolean;
  onToggle: () => void;
  items: { label: string; value: string }[];
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: Spacing.two, alignSelf: 'stretch' }}>
      <Pressable onPress={onToggle} style={styles.debugToggle}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Connection details {expanded ? '▾' : '▸'}
        </ThemedText>
      </Pressable>

      {expanded && (
        <View style={[styles.debugPanel, { backgroundColor: theme.card }]}>
          {items.map((item) => (
            <View key={item.label} style={styles.configItem}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {item.label}
              </ThemedText>
              <ThemedText type="code" selectable>
                {item.value}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <ThemedText type="smallBold" style={{ color: ErrorRed }}>
        Error
      </ThemedText>
      <ThemedText type="small" style={{ color: ErrorRed }}>
        {message}
      </ThemedText>
    </View>
  );
}

// ─── Helpers (unchanged logic) ─────────────────────────────────────────────────

function decodeIdToken(idToken: string): { name?: string; given_name?: string; email?: string } | null {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = parts[1];
    const base64Url = payload.replace(/-/g, '+').replace(/_/g, '/');
    let base64 = base64Url;
    while (base64.length % 4) {
      base64 += '=';
    }

    let decoded = '';
    const atobFunc = typeof atob === 'function' ? atob : (typeof globalThis !== 'undefined' && typeof (globalThis as any).atob === 'function' ? (globalThis as any).atob : null);
    if (atobFunc) {
      decoded = atobFunc(base64);
    } else {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      const lookup = new Uint8Array(256);
      for (let i = 0; i < chars.length; i++) {
        lookup[chars.charCodeAt(i)] = i;
      }
      const bufferLength = base64.length * 0.75;
      const len = base64.length;
      let p = 0;
      if (base64[len - 1] === '=') {
        p++;
        if (base64[len - 2] === '=') {
          p++;
        }
      }
      const bytes = new Uint8Array(bufferLength - p);
      let coords = 0;
      for (let i = 0; i < len; i += 4) {
        const chunk = (lookup[base64.charCodeAt(i)] << 18) |
                      (lookup[base64.charCodeAt(i + 1)] << 12) |
                      (lookup[base64.charCodeAt(i + 2)] << 6) |
                      lookup[base64.charCodeAt(i + 3)];

        bytes[coords++] = (chunk >> 16) & 255;
        if (coords < bytes.length) bytes[coords++] = (chunk >> 8) & 255;
        if (coords < bytes.length) bytes[coords++] = chunk & 255;
      }
      for (let i = 0; i < bytes.length; i++) {
        decoded += String.fromCharCode(bytes[i]);
      }
    }

    const utf8String = decodeURIComponent(
      decoded
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(utf8String);
  } catch (e) {
    console.warn('Failed to decode ID token:', e);
    return null;
  }
}

// ─── Styles ────────────────────────────────────────────────────────────────────
// Apple Health–style: grouped gray background, borderless rounded cards,
// monochrome controls. Color lives in the rings only.

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
  headerBlock: {
    gap: Spacing.half,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  dateLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: Spacing.three,
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
  ringsCard: {
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  sleepSlot: {
    minWidth: 140,
    flexGrow: 1,
    flexBasis: '40%',
  },
  actionButton: {
    minHeight: 50,
    paddingHorizontal: Spacing.five,
    borderRadius: 25,
    borderCurve: 'continuous',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
  errorBanner: {
    alignSelf: 'stretch',
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    gap: Spacing.half,
  },
  signInLoading: {
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  debugToggle: {
    paddingVertical: Spacing.one,
    alignSelf: 'center',
  },
  debugPanel: {
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  configItem: {
    gap: Spacing.half,
  },
  signInScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
});
