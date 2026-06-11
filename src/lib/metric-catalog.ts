/**
 * Single source of truth for every Google Health API metric the dashboard can
 * display. Field names come from the v4 discovery document — each extractor
 * reads the exact rollup/data-point shape the API returns.
 *
 * Two fetch kinds:
 * - 'rollup': data types served by dataPoints:dailyRollUp (one point per day)
 * - 'daily':  list-only daily summaries served by dataPoints?filter=<id>.date
 */

type Value = Record<string, any>;

export type MetricCategory = 'Activity' | 'Heart' | 'Body' | 'Nutrition' | 'Sleep';

export type MetricDef = {
  /** Google Health API data type id (kebab case, as used in endpoint paths) */
  id: string;
  label: string;
  /** Compact name for the ring legend; defaults to label */
  shortLabel?: string;
  unit: string;
  /** SF Symbol name (iOS) */
  icon: string;
  /** Fallback glyph for Android/web */
  glyph: string;
  category: MetricCategory;
  kind: 'rollup' | 'daily';
  /** Union field on the (rollup) data point holding this metric's value */
  field: string;
  extract: (value: Value) => number | null;
  /** How per-day values combine over multi-day ranges */
  aggregate: 'sum' | 'avg';
  fractionDigits?: number;
  /** Present when the metric can drive a ring (daily goal makes sense) */
  ring?: { goal: number; step: number };
  /** Part of the default visible card set */
  defaultCard?: boolean;
};

// ─── Value helpers (shared with google-health.ts) ──────────────────────────────

export function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function sumValues<T>(values: T[] | undefined, extract: (value: T) => number | null) {
  if (!values?.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + (extract(value) ?? 0), 0);
}

/** Parse a protobuf duration string ("123.4s") into seconds. */
export function parseDurationSeconds(duration: unknown) {
  if (typeof duration !== 'string') {
    return null;
  }

  const match = duration.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Number(match[1]) : null;
}

// ─── Catalog ───────────────────────────────────────────────────────────────────

export const METRIC_CATALOG: MetricDef[] = [
  // ── Activity ──
  {
    id: 'steps',
    label: 'Steps',
    unit: 'steps',
    icon: 'figure.walk',
    glyph: '🚶',
    category: 'Activity',
    kind: 'rollup',
    field: 'steps',
    extract: (value) => toNumber(value.countSum),
    aggregate: 'sum',
    ring: { goal: 10_000, step: 500 },
  },
  {
    id: 'active-energy-burned',
    label: 'Active calories',
    shortLabel: 'Calories',
    unit: 'kcal',
    icon: 'flame.fill',
    glyph: '🔥',
    category: 'Activity',
    kind: 'rollup',
    field: 'activeEnergyBurned',
    extract: (value) => toNumber(value.kcalSum),
    aggregate: 'sum',
    ring: { goal: 500, step: 50 },
  },
  {
    id: 'total-calories',
    label: 'Total calories',
    shortLabel: 'Total kcal',
    unit: 'kcal',
    icon: 'flame',
    glyph: '♨️',
    category: 'Activity',
    kind: 'rollup',
    field: 'totalCalories',
    extract: (value) => toNumber(value.kcalSum),
    aggregate: 'sum',
    ring: { goal: 2_500, step: 100 },
    defaultCard: true,
  },
  {
    id: 'active-minutes',
    label: 'Active minutes',
    shortLabel: 'Minutes',
    unit: 'min',
    icon: 'timer',
    glyph: '⏱️',
    category: 'Activity',
    kind: 'rollup',
    field: 'activeMinutes',
    extract: (value) => {
      const minutesByLevel = value.activeMinutesRollupByActivityLevel as
        | { activeMinutesSum?: unknown }[]
        | undefined;

      return sumValues(minutesByLevel, (item) => toNumber(item.activeMinutesSum));
    },
    aggregate: 'sum',
    ring: { goal: 30, step: 5 },
  },
  {
    id: 'active-zone-minutes',
    label: 'Zone minutes',
    shortLabel: 'Zone min',
    unit: 'min',
    icon: 'bolt.heart.fill',
    glyph: '⚡',
    category: 'Activity',
    kind: 'rollup',
    field: 'activeZoneMinutes',
    extract: (value) => {
      // The API reports int64 sums as strings, one per heart-rate zone.
      const zoneSums = [
        toNumber(value.sumInFatBurnHeartZone),
        toNumber(value.sumInCardioHeartZone),
        toNumber(value.sumInPeakHeartZone),
      ].filter((sum): sum is number => sum !== null);

      return zoneSums.length ? zoneSums.reduce((total, sum) => total + sum, 0) : null;
    },
    aggregate: 'sum',
    ring: { goal: 20, step: 5 },
  },
  {
    id: 'distance',
    label: 'Distance',
    unit: 'km',
    icon: 'location.fill',
    glyph: '📍',
    category: 'Activity',
    kind: 'rollup',
    field: 'distance',
    extract: (value) => {
      const millimeters = toNumber(value.millimetersSum);
      return millimeters === null ? null : millimeters / 1_000_000;
    },
    aggregate: 'sum',
    fractionDigits: 1,
    ring: { goal: 5, step: 0.5 },
    defaultCard: true,
  },
  {
    id: 'floors',
    label: 'Floors',
    unit: 'floors',
    icon: 'figure.stairs',
    glyph: '🪜',
    category: 'Activity',
    kind: 'rollup',
    field: 'floors',
    extract: (value) => toNumber(value.countSum),
    aggregate: 'sum',
    ring: { goal: 10, step: 1 },
  },
  {
    id: 'altitude',
    label: 'Elevation gain',
    shortLabel: 'Climb',
    unit: 'm',
    icon: 'mountain.2.fill',
    glyph: '⛰️',
    category: 'Activity',
    kind: 'rollup',
    field: 'altitude',
    extract: (value) => {
      const millimeters = toNumber(value.gainMillimetersSum);
      return millimeters === null ? null : millimeters / 1_000;
    },
    aggregate: 'sum',
    ring: { goal: 50, step: 10 },
  },
  {
    id: 'sedentary-period',
    label: 'Sedentary time',
    unit: 'h',
    icon: 'chair.lounge.fill',
    glyph: '🪑',
    category: 'Activity',
    kind: 'rollup',
    field: 'sedentaryPeriod',
    extract: (value) => {
      const seconds = parseDurationSeconds(value.durationSum);
      return seconds === null ? null : seconds / 3_600;
    },
    aggregate: 'sum',
    fractionDigits: 1,
  },
  {
    id: 'swim-lengths-data',
    label: 'Swim strokes',
    shortLabel: 'Swim',
    unit: 'strokes',
    icon: 'figure.pool.swim',
    glyph: '🏊',
    category: 'Activity',
    kind: 'rollup',
    field: 'swimLengthsData',
    extract: (value) => toNumber(value.strokeCountSum),
    aggregate: 'sum',
    ring: { goal: 500, step: 100 },
  },
  {
    id: 'run-vo2-max',
    label: 'Run VO₂ max',
    unit: 'ml/kg/min',
    icon: 'figure.run',
    glyph: '🏃',
    category: 'Activity',
    kind: 'rollup',
    field: 'runVo2Max',
    extract: (value) => toNumber(value.rateAvg),
    aggregate: 'avg',
    fractionDigits: 1,
  },

  // ── Heart ──
  {
    id: 'heart-rate',
    label: 'Avg heart rate',
    unit: 'bpm',
    icon: 'heart.fill',
    glyph: '❤️',
    category: 'Heart',
    kind: 'rollup',
    field: 'heartRate',
    extract: (value) => toNumber(value.beatsPerMinuteAvg),
    aggregate: 'avg',
    defaultCard: true,
  },
  {
    id: 'daily-resting-heart-rate',
    label: 'Resting heart rate',
    unit: 'bpm',
    icon: 'heart',
    glyph: '🫀',
    category: 'Heart',
    kind: 'daily',
    field: 'dailyRestingHeartRate',
    extract: (value) => toNumber(value.beatsPerMinute),
    aggregate: 'avg',
  },
  {
    id: 'daily-heart-rate-variability',
    label: 'Heart rate variability',
    unit: 'ms',
    icon: 'waveform.path.ecg',
    glyph: '💓',
    category: 'Heart',
    kind: 'daily',
    field: 'dailyHeartRateVariability',
    extract: (value) => toNumber(value.averageHeartRateVariabilityMilliseconds),
    aggregate: 'avg',
  },
  {
    id: 'time-in-heart-rate-zone',
    label: 'Time in HR zones',
    shortLabel: 'Zone time',
    unit: 'min',
    icon: 'heart.circle',
    glyph: '⏲️',
    category: 'Heart',
    kind: 'rollup',
    field: 'timeInHeartRateZone',
    extract: (value) => {
      const zones = value.timeInHeartRateZones as { duration?: unknown }[] | undefined;
      const seconds = sumValues(zones, (zone) => parseDurationSeconds(zone.duration));
      return seconds === null ? null : seconds / 60;
    },
    aggregate: 'sum',
    ring: { goal: 30, step: 5 },
  },
  {
    id: 'calories-in-heart-rate-zone',
    label: 'Zone calories',
    shortLabel: 'Zone kcal',
    unit: 'kcal',
    icon: 'flame.circle',
    glyph: '❤️‍🔥',
    category: 'Heart',
    kind: 'rollup',
    field: 'caloriesInHeartRateZone',
    extract: (value) => {
      const zones = value.caloriesInHeartRateZones as { kcal?: unknown }[] | undefined;
      return sumValues(zones, (zone) => toNumber(zone.kcal));
    },
    aggregate: 'sum',
    ring: { goal: 300, step: 50 },
  },
  {
    id: 'daily-vo2-max',
    label: 'VO₂ max',
    unit: 'ml/kg/min',
    icon: 'speedometer',
    glyph: '🫁',
    category: 'Heart',
    kind: 'daily',
    field: 'dailyVo2Max',
    extract: (value) => toNumber(value.vo2Max),
    aggregate: 'avg',
    fractionDigits: 1,
  },

  // ── Body ──
  {
    id: 'weight',
    label: 'Weight',
    unit: 'kg',
    icon: 'scalemass.fill',
    glyph: '⚖️',
    category: 'Body',
    kind: 'rollup',
    field: 'weight',
    extract: (value) => {
      const grams = toNumber(value.weightGramsAvg);
      return grams === null ? null : grams / 1_000;
    },
    aggregate: 'avg',
    fractionDigits: 1,
  },
  {
    id: 'body-fat',
    label: 'Body fat',
    unit: '%',
    icon: 'percent',
    glyph: '％',
    category: 'Body',
    kind: 'rollup',
    field: 'bodyFat',
    extract: (value) => toNumber(value.bodyFatPercentageAvg),
    aggregate: 'avg',
    fractionDigits: 1,
  },
  {
    id: 'core-body-temperature',
    label: 'Body temperature',
    unit: '°C',
    icon: 'thermometer.medium',
    glyph: '🌡️',
    category: 'Body',
    kind: 'rollup',
    field: 'coreBodyTemperature',
    extract: (value) => toNumber(value.temperatureCelsiusAvg),
    aggregate: 'avg',
    fractionDigits: 1,
  },
  {
    id: 'blood-glucose',
    label: 'Blood glucose',
    unit: 'mg/dL',
    icon: 'cross.case.fill',
    glyph: '🩸',
    category: 'Body',
    kind: 'rollup',
    field: 'bloodGlucose',
    extract: (value) => toNumber(value.bloodGlucoseMilligramsPerDeciliterAvg),
    aggregate: 'avg',
  },
  {
    id: 'daily-oxygen-saturation',
    label: 'Blood oxygen',
    unit: '%',
    icon: 'lungs.fill',
    glyph: 'O₂',
    category: 'Body',
    kind: 'daily',
    field: 'dailyOxygenSaturation',
    extract: (value) => toNumber(value.averagePercentage),
    aggregate: 'avg',
    fractionDigits: 1,
  },
  {
    id: 'daily-respiratory-rate',
    label: 'Respiratory rate',
    unit: 'br/min',
    icon: 'wind',
    glyph: '🌬️',
    category: 'Body',
    kind: 'daily',
    field: 'dailyRespiratoryRate',
    extract: (value) => toNumber(value.breathsPerMinute),
    aggregate: 'avg',
    fractionDigits: 1,
  },

  // ── Nutrition ──
  {
    id: 'nutrition-log',
    label: 'Calories eaten',
    shortLabel: 'Food',
    unit: 'kcal',
    icon: 'fork.knife',
    glyph: '🍽️',
    category: 'Nutrition',
    kind: 'rollup',
    field: 'nutritionLog',
    extract: (value) => toNumber(value.energy?.kcalSum),
    aggregate: 'sum',
    ring: { goal: 2_000, step: 100 },
  },
  {
    id: 'hydration-log',
    label: 'Hydration',
    shortLabel: 'Water',
    unit: 'ml',
    icon: 'drop.fill',
    glyph: '💧',
    category: 'Nutrition',
    kind: 'rollup',
    field: 'hydrationLog',
    extract: (value) => toNumber(value.amountConsumed?.millilitersSum),
    aggregate: 'sum',
    ring: { goal: 2_000, step: 250 },
  },
];

/** Pseudo-card for sleep sessions — fetched as sessions, not a metric. */
export const SLEEP_CARD_ID = 'sleep';

export const SLEEP_CARD = {
  id: SLEEP_CARD_ID,
  label: 'Sleep',
  icon: 'bed.double.fill',
  glyph: '🛏️',
  category: 'Sleep' as MetricCategory,
};

export const METRIC_CATEGORIES: MetricCategory[] = [
  'Activity',
  'Heart',
  'Body',
  'Nutrition',
  'Sleep',
];

const catalogById = new Map(METRIC_CATALOG.map((def) => [def.id, def]));

export function getMetricDef(id: string): MetricDef | undefined {
  return catalogById.get(id);
}

export const RING_ELIGIBLE_METRICS = METRIC_CATALOG.filter((def) => def.ring);

export const DEFAULT_CARD_IDS = [
  SLEEP_CARD_ID,
  ...METRIC_CATALOG.filter((def) => def.defaultCard).map((def) => def.id),
];

export const DEFAULT_RING_IDS: [string, string, string] = [
  'steps',
  'active-energy-burned',
  'active-minutes',
];

/** Default goal for a metric, for rings (non-eligible metrics return 0). */
export function getDefaultGoal(id: string) {
  return getMetricDef(id)?.ring?.goal ?? 0;
}
