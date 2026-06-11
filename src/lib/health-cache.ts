import type { HealthSnapshot } from '@/lib/google-health';

/**
 * In-memory snapshot cache keyed by dashboard range (days).
 * Lives at module scope so it survives screen remounts — switching
 * ranges or tabs renders the cached snapshot instantly, and only
 * stale entries trigger a silent background revalidation.
 */

/** Snapshots younger than this are served without hitting the network. */
const FRESH_TTL_MS = 2 * 60 * 1000;

export type SnapshotCacheEntry = {
  snapshot: HealthSnapshot;
  fetchedAt: number;
};

const cache = new Map<number, SnapshotCacheEntry>();

export function getCachedSnapshot(days: number): SnapshotCacheEntry | null {
  return cache.get(days) ?? null;
}

export function setCachedSnapshot(days: number, snapshot: HealthSnapshot) {
  cache.set(days, { snapshot, fetchedAt: Date.now() });
}

export function isSnapshotFresh(entry: SnapshotCacheEntry) {
  return Date.now() - entry.fetchedAt < FRESH_TTL_MS;
}

/** Drop everything — call on sign-out or account change. */
export function clearSnapshotCache() {
  cache.clear();
}
