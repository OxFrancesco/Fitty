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

export function GET() {
  return Response.json(
    {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      hasClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      redirectUri: getGoogleCallbackUri(),
      appReturnUri: getGoogleAppReturnUri(),
      scopes: GOOGLE_HEALTH_SCOPES,
    },
    { headers: corsHeaders }
  );
}
