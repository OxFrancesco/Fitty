/**
 * Client-side debug switch. Set EXPO_PUBLIC_DEBUG=1 (or true) in .env.local
 * to surface connection diagnostics in the UI. The value is inlined at build
 * time, so restart Expo after changing it. Must stay statically referenced
 * via dot notation — Expo does not inline dynamic process.env access.
 */
export const DEBUG_ENABLED =
  process.env.EXPO_PUBLIC_DEBUG === '1' || process.env.EXPO_PUBLIC_DEBUG === 'true';
