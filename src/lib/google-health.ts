import {
  DEFAULT_CARD_IDS,
  DEFAULT_RING_IDS,
  getMetricDef,
  parseDurationSeconds,
  SLEEP_CARD_ID,
  toNumber,
  type MetricDef,
} from '@/lib/metric-catalog';

export const GOOGLE_OAUTH_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
};

export const GOOGLE_HEALTH_SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.profile.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.nutrition.readonly',
];

const GOOGLE_HEALTH_BASE_URL = 'https://health.googleapis.com/v4';

export type GoogleHealthConfig = {
  clientId: string;
  hasClientSecret: boolean;
  redirectUri: string;
  appReturnUri: string;
};

export type GoogleTokenResponse = {
  accessToken: string;
  expiresIn?: number;
  idToken?: string;
  refreshToken?: string;
  scope?: string;
  tokenType?: string;
  issuedAt: number;
};

export type HealthMetric = {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  status: 'loaded' | 'empty' | 'error';
  error?: string;
};

export type ExerciseSummary = {
  id: string;
  name: string;
  type: string;
  startTime?: string;
  endTime?: string;
  activeMinutes: number | null;
  caloriesKcal: number | null;
  distanceKm: number | null;
  steps: number | null;
};

export type SleepSummary = {
  id: string;
  /** 'nap' when the API flags the session as a nap (or it looks like one) */
  kind: 'sleep' | 'nap';
  startTime?: string;
  endTime?: string;
  minutesAsleep: number | null;
  minutesInSleepPeriod: number | null;
};

export type HealthSnapshot = {
  identity: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  metrics: HealthMetric[];
  exercises: ExerciseSummary[];
  /** Sleep sessions in the range, most recent first */
  sleepSessions: SleepSummary[];
  rangeLabel: string;
  raw: {
    rollups: Record<string, unknown>;
    exercises: unknown;
    sleep: unknown;
    identity: unknown;
    profile: unknown;
  };
};

export type HealthSnapshotOptions = {
  days?: number;
  /** Metric ids to load; defaults to the default rings + cards */
  metricIds?: string[];
};

type DataPoint = Record<string, any>;

function toCivilDateTime(date: Date) {
  return {
    date: {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    },
    time: {
      hours: date.getHours(),
      minutes: date.getMinutes(),
      seconds: date.getSeconds(),
      nanos: 0,
    },
  };
}

function toIsoDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getRollingWindow(days: number) {
  const safeDays = Math.max(1, Math.min(Math.round(days), 90));
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (safeDays - 1));

  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

function formatRangeLabel(start: Date, endExclusive: Date) {
  const end = new Date(endExclusive);
  end.setDate(end.getDate() - 1);
  return `${toIsoDate(start)} to ${toIsoDate(end)}`;
}

async function googleHealthFetch<T>(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`${GOOGLE_HEALTH_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : null),
      ...init?.headers,
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(extractGoogleError(data, response.status));
    Object.assign(error, { status: response.status, details: data });
    throw error;
  }

  return data as T;
}

function extractGoogleError(data: unknown, status: number) {
  const error = data as { error?: { message?: string }; message?: string };
  return error?.error?.message ?? error?.message ?? `Google Health API failed with ${status}`;
}

/** Combine per-day values; null when no day in the range had data. */
function aggregateValues(values: (number | null)[], aggregate: MetricDef['aggregate']) {
  const present = values.filter((value): value is number => value !== null);

  if (!present.length) {
    return null;
  }

  const total = present.reduce((sum, value) => sum + value, 0);
  return aggregate === 'avg' ? total / present.length : total;
}

async function fetchRollupValue(accessToken: string, def: MetricDef, start: Date, end: Date) {
  const body = {
    range: {
      start: toCivilDateTime(start),
      end: toCivilDateTime(end),
    },
    windowSizeDays: 1,
  };

  const data = await googleHealthFetch<{ rollupDataPoints?: DataPoint[] }>(
    accessToken,
    `/users/me/dataTypes/${def.id}/dataPoints:dailyRollUp`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );

  const values = (data.rollupDataPoints ?? []).map((point) => {
    const rollupValue = point[def.field];
    return rollupValue ? def.extract(rollupValue) : null;
  });

  return { value: aggregateValues(values, def.aggregate), raw: data };
}

async function fetchDailyValue(accessToken: string, def: MetricDef, start: Date, end: Date) {
  // List-only daily summaries filter on their civil date field.
  const snakeId = def.id.replace(/-/g, '_');
  const filter = `${snakeId}.date >= "${toIsoDate(start)}" AND ${snakeId}.date < "${toIsoDate(end)}"`;

  const data = await googleHealthFetch<{ dataPoints?: DataPoint[] }>(
    accessToken,
    `/users/me/dataTypes/${def.id}/dataPoints?page_size=100&filter=${encodeURIComponent(filter)}`
  );

  const values = (data.dataPoints ?? []).map((point) => {
    const payload = point[def.field];
    return payload ? def.extract(payload) : null;
  });

  return { value: aggregateValues(values, def.aggregate), raw: data };
}

async function fetchMetric(accessToken: string, def: MetricDef, start: Date, end: Date) {
  const { value, raw } =
    def.kind === 'daily'
      ? await fetchDailyValue(accessToken, def, start, end)
      : await fetchRollupValue(accessToken, def, start, end);

  return {
    metric: {
      id: def.id,
      label: def.label,
      value,
      unit: def.unit,
      status: value === null ? 'empty' : 'loaded',
    } satisfies HealthMetric,
    raw,
  };
}

function sanitizeMetricIds(ids: string[]) {
  const seen = new Set<string>();
  const defs: MetricDef[] = [];

  for (const id of ids) {
    if (id === SLEEP_CARD_ID || seen.has(id)) {
      continue;
    }

    const def = getMetricDef(id);

    if (def) {
      seen.add(id);
      defs.push(def);
    }
  }

  return defs;
}

/**
 * Fetch a set of metrics by id. Used for the initial snapshot and for
 * incrementally loading metrics the user adds to rings/cards later.
 */
export async function fetchHealthMetrics(accessToken: string, metricIds: string[], days: number) {
  const { start, end } = getRollingWindow(days);
  const raw: Record<string, unknown> = {};

  const metrics = await Promise.all(
    sanitizeMetricIds(metricIds).map(async (def): Promise<HealthMetric> => {
      try {
        const result = await fetchMetric(accessToken, def, start, end);
        raw[def.id] = result.raw;
        return result.metric;
      } catch (error) {
        raw[def.id] = { error: String(error instanceof Error ? error.message : error) };
        return {
          id: def.id,
          label: def.label,
          value: null,
          unit: def.unit,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        } satisfies HealthMetric;
      }
    })
  );

  return { metrics, raw };
}

/** Merge incrementally fetched metrics into an existing snapshot. */
export function mergeSnapshotMetrics(
  snapshot: HealthSnapshot,
  metrics: HealthMetric[],
  raw: Record<string, unknown>
): HealthSnapshot {
  const updated = new Set(metrics.map((metric) => metric.id));

  return {
    ...snapshot,
    metrics: [...snapshot.metrics.filter((metric) => !updated.has(metric.id)), ...metrics],
    raw: {
      ...snapshot.raw,
      rollups: { ...snapshot.raw.rollups, ...raw },
    },
  };
}

function normalizeExercise(point: DataPoint): ExerciseSummary {
  const exercise = point.exercise ?? {};
  const activeSeconds = parseDurationSeconds(exercise.activeDuration);
  const metrics = exercise.metricsSummary ?? {};

  return {
    id: String(point.name ?? `${exercise.displayName ?? 'exercise'}-${exercise.interval?.startTime}`),
    name: String(exercise.displayName ?? exercise.exerciseType ?? 'Exercise'),
    type: String(exercise.exerciseType ?? 'OTHER'),
    startTime: exercise.interval?.startTime,
    endTime: exercise.interval?.endTime,
    activeMinutes: activeSeconds === null ? null : Math.round(activeSeconds / 60),
    caloriesKcal: toNumber(metrics.caloriesKcal),
    distanceKm:
      toNumber(metrics.distanceMillimeters) === null
        ? null
        : Number(toNumber(metrics.distanceMillimeters)) / 1_000_000,
    steps: toNumber(metrics.steps),
  };
}

function normalizeSleep(point: DataPoint): SleepSummary | null {
  const sleep = point.sleep;

  if (!sleep) {
    return null;
  }

  const startTime = sleep.interval?.startTime;
  const endTime = sleep.interval?.endTime;
  const minutesAsleep = toNumber(sleep.summary?.minutesAsleep);
  const minutesInSleepPeriod = toNumber(sleep.summary?.minutesInSleepPeriod);

  return {
    id: String(point.name ?? `sleep-${startTime ?? endTime ?? 'unknown'}`),
    kind: classifySleepKind(sleep, startTime, minutesInSleepPeriod ?? minutesAsleep),
    startTime,
    endTime,
    minutesAsleep,
    minutesInSleepPeriod,
  };
}

function classifySleepKind(
  sleep: Record<string, any>,
  startTime: string | undefined,
  minutes: number | null
): 'sleep' | 'nap' {
  // The API labels naps explicitly (Sleep.metadata.nap, output-only boolean).
  const nap = sleep.metadata?.nap;
  if (typeof nap === 'boolean') {
    return nap ? 'nap' : 'sleep';
  }

  // Fallback heuristic: short daytime sessions are naps.
  const start = startTime ? new Date(startTime) : null;
  const duration = minutes ?? 0;

  if (start && !Number.isNaN(start.getTime())) {
    const hour = start.getHours();
    if (hour >= 9 && hour < 20 && duration > 0 && duration < 360) {
      return 'nap';
    }
  }

  return duration > 0 && duration < 120 ? 'nap' : 'sleep';
}

function sleepSortValue(session: SleepSummary) {
  const date = session.endTime ? new Date(session.endTime) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

export async function fetchGoogleHealthSnapshot(
  accessToken: string,
  options: HealthSnapshotOptions = {}
): Promise<HealthSnapshot> {
  const days = options.days ?? 7;
  const metricIds = options.metricIds ?? [...DEFAULT_RING_IDS, ...DEFAULT_CARD_IDS];
  const { start, end } = getRollingWindow(days);
  const rangeLabel = formatRangeLabel(start, end);

  const exerciseFilter = `exercise.interval.civil_start_time >= "${toIsoDate(start)}" AND exercise.interval.civil_start_time < "${toIsoDate(end)}"`;
  const sleepFilter = `sleep.interval.civil_end_time >= "${toIsoDate(start)}" AND sleep.interval.civil_end_time < "${toIsoDate(end)}"`;

  const [{ metrics, raw: rollups }, identity, profile, exerciseData, sleepData] =
    await Promise.all([
      fetchHealthMetrics(accessToken, metricIds, days),
      googleHealthFetch<Record<string, unknown>>(accessToken, '/users/me/identity').catch(() => null),
      googleHealthFetch<Record<string, unknown>>(accessToken, '/users/me/profile').catch(() => null),
      googleHealthFetch<{ dataPoints?: DataPoint[] }>(
        accessToken,
        `/users/me/dataTypes/exercise/dataPoints?page_size=50&filter=${encodeURIComponent(exerciseFilter)}`
      ).catch((error) => ({ error: error instanceof Error ? error.message : String(error) })),
      googleHealthFetch<{ dataPoints?: DataPoint[] }>(
        accessToken,
        `/users/me/dataTypes/sleep/dataPoints?page_size=20&filter=${encodeURIComponent(sleepFilter)}`
      ).catch((error) => ({ error: error instanceof Error ? error.message : String(error) })),
    ]);

  const exercisePoints = 'dataPoints' in exerciseData ? exerciseData.dataPoints ?? [] : [];
  const sleepPoints = 'dataPoints' in sleepData ? sleepData.dataPoints ?? [] : [];

  return {
    identity,
    profile,
    metrics,
    exercises: exercisePoints.map(normalizeExercise),
    sleepSessions: sleepPoints
      .map(normalizeSleep)
      .filter((session): session is SleepSummary => session !== null)
      .sort((a, b) => sleepSortValue(b) - sleepSortValue(a)),
    rangeLabel,
    raw: {
      rollups,
      exercises: exerciseData,
      sleep: sleepData,
      identity,
      profile,
    },
  };
}

export function formatMetricValue(metric: HealthMetric) {
  if (metric.value === null) {
    return '--';
  }

  const digits = getMetricDef(metric.id)?.fractionDigits ?? 0;
  return metric.value.toLocaleString(undefined, { maximumFractionDigits: digits });
}
