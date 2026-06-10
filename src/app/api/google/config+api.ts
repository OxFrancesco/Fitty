import { GOOGLE_HEALTH_SCOPES } from '@/lib/google-health';
import { getGoogleAppReturnUri, getGoogleCallbackUri } from '@/lib/google-oauth-server';

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

  return Response.json(
    {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      hasClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      redirectUri: isWeb ? `${requestUrl.origin}/api/google/callback` : getGoogleCallbackUri(),
      appReturnUri: isWeb ? requestUrl.origin : getGoogleAppReturnUri(),
      scopes: GOOGLE_HEALTH_SCOPES,
    },
    { headers: corsHeaders }
  );
}
