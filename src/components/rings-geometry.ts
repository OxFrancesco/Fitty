/**
 * Shared geometry for the activity rings — consumed by both the Skia
 * implementation (native) and the SVG fallback (web).
 */

export const SIZE = 168;
export const STROKE = 14;
export const GAP = 4;
export const CENTER = SIZE / 2;
export const RADII = [
  (SIZE - STROKE) / 2,
  (SIZE - STROKE) / 2 - (STROKE + GAP),
  (SIZE - STROKE) / 2 - 2 * (STROKE + GAP),
] as const;

export type RingProgress = {
  key: string;
  color: string;
  /** Fraction of the goal, clamped to [0, 1] */
  progress: number;
  /** Entrance animation delay in ms */
  delay: number;
};

/** Mix a #RRGGBB color toward white (amount 0..1). */
export function lighten(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => Math.round(c + (255 - c) * amount);
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
