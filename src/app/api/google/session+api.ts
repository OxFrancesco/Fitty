import { takeGoogleOAuthSession } from '@/lib/google-oauth-server';

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
  const state = requestUrl.searchParams.get('state');

  if (!state) {
    return Response.json({ error: 'Missing OAuth state' }, { status: 400, headers: corsHeaders });
  }

  const token = takeGoogleOAuthSession(state);

  if (!token) {
    return Response.json(
      { error: 'OAuth session was not found or has expired. Try signing in again.' },
      { status: 404, headers: corsHeaders }
    );
  }

  return Response.json(token, { headers: corsHeaders });
}
