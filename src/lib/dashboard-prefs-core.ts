import {
  DEFAULT_CARD_IDS,
  DEFAULT_RING_IDS,
  getMetricDef,
  RING_ELIGIBLE_METRICS,
  SLEEP_CARD_ID,
} from '@/lib/metric-catalog';

/**
 * Shared shape + validation for dashboard preferences. Platform modules
 * (dashboard-prefs.ts / dashboard-prefs.web.ts) handle storage.
 */

export type DashboardPrefs = {
  /** Metric id per ring slot (outer, middle, inner) */
  rings: [string, string, string];
  /** Metric id per widget value slot (first, second, third) */
  widgetMetrics: [string, string, string];
  /** Per-metric goal overrides; defaults come from the catalog */
  goals: Record<string, number>;
  /** Visible card ids in display order ('sleep' is a pseudo-card) */
  cards: string[];
};

export const PREFS_KEY = 'fitty.dashboard_prefs';
export const LEGACY_GREEN_RING_KEY = 'fitty.green_ring_metric';

export function defaultPrefs(): DashboardPrefs {
  return {
    rings: [...DEFAULT_RING_IDS],
    widgetMetrics: [...DEFAULT_RING_IDS],
    goals: {},
    cards: [...DEFAULT_CARD_IDS],
  };
}

function normalizeRings(value: unknown): [string, string, string] {
  const incoming = Array.isArray(value) ? value : [];
  const used = new Set<string>();

  const rings = DEFAULT_RING_IDS.map((fallback, slot) => {
    const candidate = typeof incoming[slot] === 'string' ? (incoming[slot] as string) : fallback;
    let id = getMetricDef(candidate)?.ring && !used.has(candidate) ? candidate : fallback;

    if (used.has(id)) {
      id = RING_ELIGIBLE_METRICS.find((def) => !used.has(def.id))?.id ?? fallback;
    }

    used.add(id);
    return id;
  });

  return rings as [string, string, string];
}

function normalizeGoals(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const goals: Record<string, number> = {};

  for (const [id, goal] of Object.entries(value)) {
    if (getMetricDef(id)?.ring && typeof goal === 'number' && Number.isFinite(goal) && goal > 0) {
      goals[id] = goal;
    }
  }

  return goals;
}

function normalizeCards(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_CARD_IDS];
  }

  const seen = new Set<string>();
  const cards: string[] = [];

  for (const id of value) {
    if (typeof id !== 'string' || seen.has(id)) {
      continue;
    }

    if (id !== SLEEP_CARD_ID && !getMetricDef(id)) {
      continue;
    }

    seen.add(id);
    cards.push(id);
  }

  // An empty list is a valid choice — the user removed every card.
  return cards;
}

function normalizeWidgetMetrics(value: unknown, rings: [string, string, string]): [string, string, string] {
  const incoming = Array.isArray(value) ? value : [];
  const used = new Set<string>();

  const widgetMetrics = rings.map((fallback, slot) => {
    const candidate = typeof incoming[slot] === 'string' ? (incoming[slot] as string) : fallback;
    let id = getMetricDef(candidate) && !used.has(candidate) ? candidate : fallback;

    if (used.has(id)) {
      id =
        [...DEFAULT_RING_IDS, ...RING_ELIGIBLE_METRICS.map((def) => def.id)].find(
          (metricId) => getMetricDef(metricId) && !used.has(metricId)
        ) ?? fallback;
    }

    used.add(id);
    return id;
  });

  return widgetMetrics as [string, string, string];
}

/**
 * Parse stored prefs, tolerating unknown ids from older app versions.
 * `legacyGreenId` migrates the pre-prefs single green-ring choice.
 */
export function decodePrefs(rawJson: string | null, legacyGreenId: string | null): DashboardPrefs {
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as Partial<DashboardPrefs>;
      const rings = normalizeRings(parsed.rings);
      return {
        rings,
        widgetMetrics: normalizeWidgetMetrics(parsed.widgetMetrics, rings),
        goals: normalizeGoals(parsed.goals),
        cards: normalizeCards(parsed.cards),
      };
    } catch {
      // Corrupt JSON — fall through to defaults.
    }
  }

  const prefs = defaultPrefs();

  if (legacyGreenId && getMetricDef(legacyGreenId)?.ring) {
    prefs.rings = normalizeRings([prefs.rings[0], prefs.rings[1], legacyGreenId]);
    prefs.widgetMetrics = normalizeWidgetMetrics(null, prefs.rings);
  }

  return prefs;
}
