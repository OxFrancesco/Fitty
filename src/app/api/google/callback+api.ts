import {
  exchangeGoogleCode,
  getGoogleAppReturnUri,
  getGoogleCallbackUri,
  storeGoogleOAuthSession,
} from '@/lib/google-oauth-server';

function buildAppRedirect(params: Record<string, string>) {
  const url = new URL(getGoogleAppReturnUri());

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url;
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
    return Response.redirect(buildAppRedirect({ state, error: oauthError }), 302);
  }

  if (!code) {
    return Response.redirect(
      buildAppRedirect({ state, error: 'Missing authorization code from Google callback' }),
      302
    );
  }

  try {
    const token = await exchangeGoogleCode({
      code,
      redirectUri: getGoogleCallbackUri(),
      includeClientSecret: true,
    });
    storeGoogleOAuthSession(state, token);
    return Response.redirect(buildAppRedirect({ state, status: 'success' }), 302);
  } catch (error) {
    return Response.redirect(
      buildAppRedirect({
        state,
        error: error instanceof Error ? error.message : String(error),
      }),
      302
    );
  }
}
