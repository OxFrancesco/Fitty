import { getGoogleAppReturnUri } from '@/lib/google-oauth-server';

function buildAppRedirect(params: Record<string, string>) {
  const url = new URL(getGoogleAppReturnUri());

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url;
}

function buildStateAppRedirect(state: string | null, params: Record<string, string>) {
  const url = new URL(getAllowedAppReturnUriFromState(state) ?? getGoogleAppReturnUri());

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url;
}

function getAllowedAppReturnUriFromState(state: string | null) {
  if (!state) {
    return null;
  }

  const encodedReturnUri = state.slice(state.indexOf('.') + 1);

  if (!encodedReturnUri || encodedReturnUri === state) {
    return null;
  }

  try {
    const returnUri = decodeURIComponent(encodedReturnUri);
    return isAllowedAppReturnUri(returnUri) ? returnUri : null;
  } catch {
    return null;
  }
}

function isAllowedAppReturnUri(returnUri: string) {
  if (returnUri === getGoogleAppReturnUri()) {
    return true;
  }

  try {
    const url = new URL(returnUri);
    const localhostHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

    return (
      url.protocol === 'fitty:' ||
      url.protocol === 'com.francescooddo.fitty:' ||
      ((url.protocol === 'http:' || url.protocol === 'https:') && localhostHosts.has(url.hostname))
    );
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const oauthError =
    requestUrl.searchParams.get('error_description') ?? requestUrl.searchParams.get('error');

  if (!state) {
    return Response.redirect(
      buildAppRedirect({ error: 'Missing OAuth state from Google callback' }),
      302
    );
  }

  if (oauthError) {
    return Response.redirect(buildStateAppRedirect(state, { state, error: oauthError }), 302);
  }

  if (!code) {
    return Response.redirect(
      buildStateAppRedirect(state, { state, error: 'Missing authorization code from Google callback' }),
      302
    );
  }

  // Forward the one-time authorization code to the app, which exchanges it
  // via /api/google/token. Keeping the handoff stateless matters on serverless
  // hosting, where the callback and a follow-up request can hit different
  // instances and an in-memory session would be lost.
  return Response.redirect(
    buildStateAppRedirect(state, { state, code, status: 'success' }),
    302
  );
}
