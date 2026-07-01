/**
 * Canonical handling for Google OAuth return parameters. The callback can land
 * on several entry points (custom-scheme intent, /oauth route, unknown web
 * paths) — they all normalize params through this module before forwarding to
 * the home screen.
 */

/** Params that mark a URL as an OAuth return and are worth forwarding. */
export const OAUTH_PARAM_KEYS = ['code', 'state', 'error', 'error_description', 'status'] as const;

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Filters route params down to single-valued OAuth params. */
export function pickOAuthParams(params: Record<string, string | string[] | undefined>) {
  const picked: Record<string, string> = {};

  for (const key of OAUTH_PARAM_KEYS) {
    const value = firstParam(params[key]);

    if (value) {
      picked[key] = value;
    }
  }

  return picked;
}

export function hasOAuthParams(searchParams: URLSearchParams) {
  return OAUTH_PARAM_KEYS.some((key) => searchParams.has(key));
}
