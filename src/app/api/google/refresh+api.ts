import { refreshGoogleAccessToken } from '@/lib/google-oauth-server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type RefreshBody = {
  refreshToken?: string;
};

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request: Request) {
  let body: RefreshBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders });
  }

  if (!body.refreshToken) {
    return Response.json({ error: 'Missing refreshToken' }, { status: 400, headers: corsHeaders });
  }

  try {
    const token = await refreshGoogleAccessToken(body.refreshToken);

    return Response.json(token, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 400, headers: corsHeaders }
    );
  }
}
