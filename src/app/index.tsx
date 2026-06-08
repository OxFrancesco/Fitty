import * as ExpoCrypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchApiJson, getApiBaseUrl } from '@/lib/api-base';
import {
  fetchGoogleHealthSnapshot,
  formatMetricValue,
  GOOGLE_HEALTH_SCOPES,
  GOOGLE_OAUTH_DISCOVERY,
  type ExerciseSummary,
  type GoogleHealthConfig,
  type GoogleTokenResponse,
  type HealthMetric,
  type HealthSnapshot,
} from '@/lib/google-health';

WebBrowser.maybeCompleteAuthSession();

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';
type DashboardRangeDays = 7 | 14 | 30 | 90;
type ExerciseSortKey = 'date' | 'duration' | 'calories' | 'distance' | 'steps' | 'name';
type SortDirection = 'asc' | 'desc';
type ActivityPresenceFilter = 'all' | 'calories' | 'distance' | 'steps';

const GOOGLE_NATIVE_REDIRECT_URI = 'com.francescooddo.fitty:/oauth';
const RANGE_OPTIONS: Array<{ label: string; value: DashboardRangeDays }> = [
  { label: '7D', value: 7 },
  { label: '14D', value: 14 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
];
const EXERCISE_SORT_OPTIONS: Array<{ label: string; value: ExerciseSortKey }> = [
  { label: 'Date', value: 'date' },
  { label: 'Duration', value: 'duration' },
  { label: 'Calories', value: 'calories' },
  { label: 'Distance', value: 'distance' },
  { label: 'Steps', value: 'steps' },
  { label: 'Name', value: 'name' },
];
const ACTIVITY_FILTER_OPTIONS: Array<{ label: string; value: ActivityPresenceFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Calories', value: 'calories' },
  { label: 'Distance', value: 'distance' },
  { label: 'Steps', value: 'steps' },
];
const MIN_DURATION_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: '10+ min', value: 10 },
  { label: '30+ min', value: 30 },
  { label: '60+ min', value: 60 },
];

function createOAuthState() {
  return ExpoCrypto.randomUUID();
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
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [config, setConfig] = useState<GoogleHealthConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [token, setToken] = useState<GoogleTokenResponse | null>(null);
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [authState, setAuthState] = useState<LoadState>('idle');
  const [healthState, setHealthState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState<DashboardRangeDays>(7);
  const [visibleMetricIds, setVisibleMetricIds] = useState<string[]>(
    () => placeholderMetrics.map((metric) => metric.id)
  );
  const [activityQuery, setActivityQuery] = useState('');
  const [activityPresenceFilter, setActivityPresenceFilter] = useState<ActivityPresenceFilter>('all');
  const [activityMinDuration, setActivityMinDuration] = useState(0);
  const [exerciseSortKey, setExerciseSortKey] = useState<ExerciseSortKey>('date');
  const [exerciseSortDirection, setExerciseSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    let ignore = false;

    async function loadConfig() {
      try {
        const data = await fetchApiJson<GoogleHealthConfig>('/api/google/config');

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

  const loadHealthData = useCallback(async (accessToken: string, days: DashboardRangeDays) => {
    setHealthState('loading');
    setError(null);

    try {
      const healthSnapshot = await fetchGoogleHealthSnapshot(accessToken, { days });
      setSnapshot(healthSnapshot);
      setHealthState('loaded');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setHealthState('error');
    }
  }, []);

  const startGoogleSignIn = useCallback(async () => {
    if (!config?.clientId || !config.hasClientSecret || !config.redirectUri || !config.appReturnUri) {
      setError('Google OAuth is not ready. Check .env.local and restart Expo.');
      return;
    }

    setAuthState('loading');
    setError(null);

    try {
      const state = createOAuthState();
      const result = await WebBrowser.openAuthSessionAsync(
        buildGoogleAuthUrl(config, state),
        config.appReturnUri || GOOGLE_NATIVE_REDIRECT_URI
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
      setToken(nextToken);
      setAuthState('loaded');
      await loadHealthData(nextToken.accessToken, rangeDays);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : String(signInError));
      setAuthState('error');
    }
  }, [config, loadHealthData, rangeDays, token]);

  const refreshHealthData = useCallback(() => {
    if (token?.accessToken) {
      loadHealthData(token.accessToken, rangeDays);
    }
  }, [loadHealthData, rangeDays, token?.accessToken]);

  const updateRangeDays = useCallback(
    (days: DashboardRangeDays) => {
      setRangeDays(days);

      if (token?.accessToken) {
        loadHealthData(token.accessToken, days);
      }
    },
    [loadHealthData, token?.accessToken]
  );

  const signOut = useCallback(() => {
    setToken(null);
    setSnapshot(null);
    setError(null);
    setAuthState('idle');
    setHealthState('idle');
  }, []);

  const canLogin = Boolean(config?.clientId && config.hasClientSecret && config.redirectUri && config.appReturnUri);
  const dashboardMetrics = snapshot?.metrics ?? placeholderMetrics;
  const visibleMetricSet = useMemo(() => new Set(visibleMetricIds), [visibleMetricIds]);
  const visibleMetrics = useMemo(
    () => dashboardMetrics.filter((metric) => visibleMetricSet.has(metric.id)),
    [dashboardMetrics, visibleMetricSet]
  );
  const filteredExercises = useMemo(
    () =>
      filterAndSortExercises({
        exercises: snapshot?.exercises ?? [],
        query: activityQuery,
        presenceFilter: activityPresenceFilter,
        minDuration: activityMinDuration,
        sortKey: exerciseSortKey,
        sortDirection: exerciseSortDirection,
      }),
    [
      activityMinDuration,
      activityPresenceFilter,
      activityQuery,
      exerciseSortDirection,
      exerciseSortKey,
      snapshot?.exercises,
    ]
  );

  const toggleMetric = useCallback((metricId: string) => {
    setVisibleMetricIds((current) =>
      current.includes(metricId) ? current.filter((id) => id !== metricId) : [...current, metricId]
    );
  }, []);

  const resetDashboardControls = useCallback(() => {
    setVisibleMetricIds(placeholderMetrics.map((metric) => metric.id));
    setActivityQuery('');
    setActivityPresenceFilter('all');
    setActivityMinDuration(0);
    setExerciseSortKey('date');
    setExerciseSortDirection('desc');
  }, []);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.titleGroup}>
              <ThemedText style={styles.eyebrow} themeColor="textSecondary">
                Google Health
              </ThemedText>
              <ThemedText type="title" style={styles.title}>
                Fitty
              </ThemedText>
            </View>

            <StatusPill
              label={token ? 'Connected' : authState === 'loading' ? 'Signing in' : 'Signed out'}
              color={token ? '#0F9D58' : authState === 'loading' ? '#F4B400' : colors.textSecondary}
            />
          </View>

          <ThemedView type="backgroundElement" style={styles.panel}>
            <View style={styles.connectionHeader}>
              <View style={styles.connectionText}>
                <ThemedText type="subtitle" style={styles.panelTitle}>
                  Google account
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {token ? 'Access token active for this session.' : 'OAuth code flow with server token exchange.'}
                </ThemedText>
              </View>

              {authState === 'loading' ? (
                <ActivityIndicator />
              ) : token ? (
                <ActionButton label="Sign out" variant="ghost" onPress={signOut} />
              ) : (
                <ActionButton label="Sign in" disabled={!canLogin} onPress={startGoogleSignIn} />
              )}
            </View>

            <View style={styles.configGrid}>
              <ConfigItem label="API server" value={getApiBaseUrl()} />
              <ConfigItem label="Console redirect URI" value={config?.redirectUri ?? 'Loading'} />
              <ConfigItem label="App callback URI" value={config?.appReturnUri ?? GOOGLE_NATIVE_REDIRECT_URI} />
              <ConfigItem
                label="OAuth client"
                value={config?.clientId ? 'Configured' : configError ?? 'Loading'}
              />
              <ConfigItem
                label="Client secret"
                value={config?.hasClientSecret ? 'Server only' : 'Missing'}
              />
            </View>
          </ThemedView>

          {error && <ErrorBanner message={error} />}

          <View style={styles.sectionHeader}>
            <View>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Health data
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {snapshot?.rangeLabel ?? 'Last 7 days'}
              </ThemedText>
            </View>

            {token && (
              <ActionButton
                label="Refresh"
                variant="ghost"
                disabled={healthState === 'loading'}
                onPress={refreshHealthData}
              />
            )}
          </View>

          <ThemedView type="backgroundElement" style={styles.panel}>
            <View style={styles.controlsHeader}>
              <ThemedText type="subtitle" style={styles.panelTitle}>
                Dashboard controls
              </ThemedText>
              <ActionButton label="Reset" variant="ghost" onPress={resetDashboardControls} />
            </View>

            <ControlGroup label="Date range">
              <View style={styles.chipRow}>
                {RANGE_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    active={rangeDays === option.value}
                    disabled={healthState === 'loading'}
                    onPress={() => updateRangeDays(option.value)}
                  />
                ))}
              </View>
            </ControlGroup>

            <ControlGroup label="Metrics">
              <View style={styles.chipRow}>
                {dashboardMetrics.map((metric) => (
                  <FilterChip
                    key={metric.id}
                    label={metric.label}
                    active={visibleMetricSet.has(metric.id)}
                    onPress={() => toggleMetric(metric.id)}
                  />
                ))}
              </View>
            </ControlGroup>

            <ControlGroup label="Activity search">
              <TextInput
                value={activityQuery}
                onChangeText={setActivityQuery}
                placeholder="Name or type"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.searchInput,
                  {
                    color: colors.text,
                    borderColor: colors.backgroundSelected,
                    backgroundColor: colors.background,
                  },
                ]}
              />
            </ControlGroup>

            <View style={styles.controlColumns}>
              <ControlGroup label="Activity sort">
                <View style={styles.chipRow}>
                  {EXERCISE_SORT_OPTIONS.map((option) => (
                    <FilterChip
                      key={option.value}
                      label={option.label}
                      active={exerciseSortKey === option.value}
                      onPress={() => setExerciseSortKey(option.value)}
                    />
                  ))}
                  <FilterChip
                    label={exerciseSortDirection === 'desc' ? 'High first' : 'Low first'}
                    active
                    onPress={() =>
                      setExerciseSortDirection((direction) => (direction === 'desc' ? 'asc' : 'desc'))
                    }
                  />
                </View>
              </ControlGroup>

              <ControlGroup label="Activity filter">
                <View style={styles.chipRow}>
                  {ACTIVITY_FILTER_OPTIONS.map((option) => (
                    <FilterChip
                      key={option.value}
                      label={option.label}
                      active={activityPresenceFilter === option.value}
                      onPress={() => setActivityPresenceFilter(option.value)}
                    />
                  ))}
                </View>
              </ControlGroup>

              <ControlGroup label="Duration">
                <View style={styles.chipRow}>
                  {MIN_DURATION_OPTIONS.map((option) => (
                    <FilterChip
                      key={option.value}
                      label={option.label}
                      active={activityMinDuration === option.value}
                      onPress={() => setActivityMinDuration(option.value)}
                    />
                  ))}
                </View>
              </ControlGroup>
            </View>
          </ThemedView>

          {healthState === 'loading' && (
            <ThemedView type="backgroundElement" style={styles.loadingPanel}>
              <ActivityIndicator />
              <ThemedText type="small" themeColor="textSecondary">
                Loading Google Health data
              </ThemedText>
            </ThemedView>
          )}

          <View style={styles.metricGrid}>
            {visibleMetrics.map((metric) => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </View>
          {!visibleMetrics.length && (
            <ThemedView type="backgroundElement" style={styles.loadingPanel}>
              <EmptyText label="No metrics selected." />
              <ActionButton
                label="Show all"
                variant="ghost"
                onPress={() => setVisibleMetricIds(placeholderMetrics.map((metric) => metric.id))}
              />
            </ThemedView>
          )}

          <View style={styles.twoColumn}>
            <ThemedView type="backgroundElement" style={styles.panel}>
              <View style={styles.panelHeadingRow}>
                <ThemedText type="subtitle" style={styles.panelTitle}>
                  Exercise
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {snapshot ? `${filteredExercises.length}/${snapshot.exercises.length}` : '0/0'}
                </ThemedText>
              </View>

              {filteredExercises.length ? (
                <View style={styles.list}>
                  {filteredExercises.map((exercise) => (
                    <View key={exercise.id} style={styles.listItem}>
                      <View style={styles.listItemMain}>
                        <ThemedText type="smallBold">{exercise.name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {formatDateTime(exercise.startTime)} | {exercise.type}
                        </ThemedText>
                      </View>
                      <View style={styles.exerciseStats}>
                        <ExerciseStat label="Active" value={formatMinutes(exercise.activeMinutes)} />
                        <ExerciseStat label="Kcal" value={formatOptionalNumber(exercise.caloriesKcal)} />
                        <ExerciseStat label="Km" value={formatOptionalDistance(exercise.distanceKm)} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <EmptyText
                  label={
                    token && snapshot?.exercises.length
                      ? 'No exercise matches these controls.'
                      : token
                        ? 'No exercise sessions in this range.'
                        : 'Sign in to load exercise.'
                  }
                />
              )}
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.panel}>
              <ThemedText type="subtitle" style={styles.panelTitle}>
                Sleep
              </ThemedText>

              {snapshot?.sleep ? (
                <View style={styles.sleepGrid}>
                  <ConfigItem
                    label="Asleep"
                    value={
                      snapshot.sleep.minutesAsleep === null
                        ? '--'
                        : `${snapshot.sleep.minutesAsleep} min`
                    }
                  />
                  <ConfigItem label="Ended" value={formatDateTime(snapshot.sleep.endTime)} />
                </View>
              ) : (
                <EmptyText label={token ? 'No sleep session in this range.' : 'Sign in to load sleep.'} />
              )}
            </ThemedView>
          </View>
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const placeholderMetrics: HealthMetric[] = [
  { id: 'steps', label: 'Steps', value: null, unit: 'steps', status: 'empty' },
  { id: 'active-energy-burned', label: 'Active calories', value: null, unit: 'kcal', status: 'empty' },
  { id: 'total-calories', label: 'Total calories', value: null, unit: 'kcal', status: 'empty' },
  { id: 'active-minutes', label: 'Active minutes', value: null, unit: 'min', status: 'empty' },
  { id: 'distance', label: 'Distance', value: null, unit: 'km', status: 'empty' },
  { id: 'floors', label: 'Floors', value: null, unit: 'floors', status: 'empty' },
  { id: 'heart-rate', label: 'Avg heart rate', value: null, unit: 'bpm', status: 'empty' },
];

function ActionButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'ghost' ? styles.ghostButton : styles.primaryButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressed,
      ]}>
      <ThemedText type="smallBold" style={variant === 'primary' && styles.primaryButtonText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.statusPill, { borderColor: color }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <ThemedText type="smallBold">{label}</ThemedText>
    </View>
  );
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.configItem}>
      <ThemedText type="code" themeColor="textSecondary" style={styles.configLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.configValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function MetricCard({ metric }: { metric: HealthMetric }) {
  const statusColor =
    metric.status === 'error' ? '#DB4437' : metric.status === 'loaded' ? '#0F9D58' : '#9AA0A6';

  return (
    <ThemedView type="backgroundElement" style={styles.metricCard}>
      <View style={styles.metricTitleRow}>
        <ThemedText type="smallBold">{metric.label}</ThemedText>
        <View style={[styles.metricStatus, { backgroundColor: statusColor }]} />
      </View>
      <View style={styles.metricValueRow}>
        <ThemedText style={styles.metricValue}>{formatMetricValue(metric)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {metric.unit}
        </ThemedText>
      </View>
      {metric.error && (
        <ThemedText type="code" themeColor="textSecondary" numberOfLines={2}>
          {metric.error}
        </ThemedText>
      )}
    </ThemedView>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <ThemedText type="smallBold" style={styles.errorTitle}>
        Error
      </ThemedText>
      <ThemedText type="small" style={styles.errorText}>
        {message}
      </ThemedText>
    </View>
  );
}

function EmptyText({ label }: { label: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
      {label}
    </ThemedText>
  );
}

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.controlGroup}>
      <ThemedText type="code" themeColor="textSecondary" style={styles.configLabel}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

function FilterChip({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.activeChip : styles.inactiveChip,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressed,
      ]}>
      <ThemedText type="smallBold" style={active && styles.activeChipText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function ExerciseStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.exerciseStat}>
      <ThemedText type="code" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.exerciseStatValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function filterAndSortExercises({
  exercises,
  query,
  presenceFilter,
  minDuration,
  sortKey,
  sortDirection,
}: {
  exercises: ExerciseSummary[];
  query: string;
  presenceFilter: ActivityPresenceFilter;
  minDuration: number;
  sortKey: ExerciseSortKey;
  sortDirection: SortDirection;
}) {
  const normalizedQuery = query.trim().toLowerCase();

  return exercises
    .filter((exercise) => {
      const matchesSearch =
        !normalizedQuery ||
        exercise.name.toLowerCase().includes(normalizedQuery) ||
        exercise.type.toLowerCase().includes(normalizedQuery);

      if (!matchesSearch) {
        return false;
      }

      if ((exercise.activeMinutes ?? 0) < minDuration) {
        return false;
      }

      if (presenceFilter === 'calories') {
        return exercise.caloriesKcal !== null;
      }

      if (presenceFilter === 'distance') {
        return exercise.distanceKm !== null;
      }

      if (presenceFilter === 'steps') {
        return exercise.steps !== null;
      }

      return true;
    })
    .sort((left, right) => compareExercises(left, right, sortKey, sortDirection));
}

function compareExercises(
  left: ExerciseSummary,
  right: ExerciseSummary,
  sortKey: ExerciseSortKey,
  sortDirection: SortDirection
) {
  if (sortKey === 'name') {
    const result = left.name.localeCompare(right.name);
    return sortDirection === 'asc' ? result : -result;
  }

  const leftValue = getExerciseSortValue(left, sortKey);
  const rightValue = getExerciseSortValue(right, sortKey);

  if (leftValue === null && rightValue === null) {
    return 0;
  }

  if (leftValue === null) {
    return 1;
  }

  if (rightValue === null) {
    return -1;
  }

  const result = leftValue - rightValue;
  return sortDirection === 'asc' ? result : -result;
}

function getExerciseSortValue(exercise: ExerciseSummary, sortKey: ExerciseSortKey) {
  if (sortKey === 'date') {
    const date = exercise.startTime ? new Date(exercise.startTime) : null;
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
  }

  if (sortKey === 'duration') {
    return exercise.activeMinutes;
  }

  if (sortKey === 'calories') {
    return exercise.caloriesKcal;
  }

  if (sortKey === 'distance') {
    return exercise.distanceKm;
  }

  return exercise.steps;
}

function formatDateTime(value?: string) {
  if (!value) {
    return '--';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMinutes(value: number | null) {
  return value === null ? '--' : `${value} min`;
}

function formatOptionalNumber(value: number | null) {
  return value === null ? '--' : Math.round(value).toLocaleString();
}

function formatOptionalDistance(value: number | null) {
  return value === null ? '--' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
  },
  safeArea: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  header: {
    paddingTop: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  titleGroup: {
    flexShrink: 1,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  title: {
    fontSize: 42,
    lineHeight: 48,
  },
  statusPill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  panel: {
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  controlsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  controlColumns: {
    gap: Spacing.three,
  },
  controlGroup: {
    gap: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  activeChip: {
    borderColor: '#1A73E8',
    backgroundColor: '#1A73E8',
  },
  inactiveChip: {
    borderColor: '#9AA0A6',
    backgroundColor: 'transparent',
  },
  activeChipText: {
    color: '#FFFFFF',
  },
  searchInput: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 500,
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  connectionText: {
    flex: 1,
    gap: Spacing.one,
  },
  panelTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  configGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  configItem: {
    minWidth: 150,
    flex: 1,
    gap: Spacing.one,
  },
  configLabel: {
    textTransform: 'uppercase',
  },
  configValue: {
    flexWrap: 'wrap',
  },
  button: {
    minHeight: 40,
    minWidth: 94,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
  },
  primaryButton: {
    backgroundColor: '#1A73E8',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: '#9AA0A6',
  },
  disabledButton: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.72,
  },
  errorBanner: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DB4437',
    backgroundColor: 'rgba(219, 68, 55, 0.12)',
    padding: Spacing.three,
    gap: Spacing.one,
  },
  errorTitle: {
    color: '#DB4437',
  },
  errorText: {
    color: '#DB4437',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  sectionTitle: {
    fontSize: 26,
    lineHeight: 32,
  },
  loadingPanel: {
    borderRadius: 8,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  metricCard: {
    borderRadius: 8,
    padding: Spacing.three,
    minWidth: 150,
    flexGrow: 1,
    flexBasis: '30%',
    gap: Spacing.two,
  },
  metricTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  metricStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  metricValue: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: 700,
  },
  twoColumn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  panelHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#9AA0A6',
  },
  listItemMain: {
    flex: 1,
    gap: Spacing.one,
  },
  exerciseStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.one,
    maxWidth: 220,
  },
  exerciseStat: {
    minWidth: 62,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#9AA0A6',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    gap: Spacing.half,
  },
  exerciseStatValue: {
    fontVariant: ['tabular-nums'],
  },
  sleepGrid: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  emptyText: {
    paddingVertical: Spacing.two,
  },
});
