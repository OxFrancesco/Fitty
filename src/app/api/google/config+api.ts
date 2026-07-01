import { GOOGLE_HEALTH_SCOPES } from '@/lib/google-health';
import {
  getConfiguredGoogleCallbackUri,
  getGoogleAppReturnUri,
  getGoogleCallbackUri,
  getUrlOrigin,
} from '@/lib/google-oauth-server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const isWeb = requestUrl.searchParams.get('platform') === 'web';
  const localRedirectUri = `${requestUrl.origin}/api/google/callback`;
  const redirectUri =
    process.env.NODE_ENV === 'development'
      ? (getConfiguredGoogleCallbackUri() ?? localRedirectUri)
      : getGoogleCallbackUri();
  const webReturnUri = getUrlOrigin(redirectUri) ?? requestUrl.origin;

  return Response.json(
    {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      hasClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      redirectUri,
      appReturnUri: isWeb ? webReturnUri : getGoogleAppReturnUri(),
      scopes: GOOGLE_HEALTH_SCOPES,
    },
    { headers: corsHeaders }
  );
}
