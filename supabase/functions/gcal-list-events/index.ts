import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Fetch Google Calendar events for a date range.
 *
 * Body: { timeMin: string (ISO), timeMax: string (ISO) }
 * Returns: { events: GCalEvent[] }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<{ access_token: string; expires_in: number } | null> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  if (!resp.ok) {
    console.error('Token refresh failed:', await resp.text());
    return null;
  }
  return resp.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

    // Auth
    const authHeader =
      req.headers.get('authorization') ??
      req.headers.get('Authorization');

    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const accessToken = tokenMatch?.[1];
    if (!accessToken) {
      return jsonResponse({ error: 'Invalid Authorization header' }, { status: 401 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = userData.user.id;

    // Parse body
    const { timeMin, timeMax } = await req.json();
    if (!timeMin || !timeMax) {
      return jsonResponse({ error: 'Missing timeMin or timeMax' }, { status: 400 });
    }

    // Get user's Google tokens
    const { data: tokenRow, error: tokenErr } = await supabaseAdmin
      .from('user_google_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (tokenErr || !tokenRow) {
      return jsonResponse({ error: 'Google Calendar not connected' }, { status: 400 });
    }

    // Refresh token if expired (with 60s buffer)
    let googleAccessToken = tokenRow.access_token;
    const expiresAt = new Date(tokenRow.token_expires_at).getTime();
    if (Date.now() > expiresAt - 60_000) {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token, clientId, clientSecret);
      if (!refreshed) {
        return jsonResponse({ error: 'Failed to refresh Google token. Please reconnect.' }, { status: 401 });
      }
      googleAccessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

      await supabaseAdmin
        .from('user_google_tokens')
        .update({ access_token: googleAccessToken, token_expires_at: newExpiry })
        .eq('user_id', userId);
    }

    const calendarId = tokenRow.calendar_id || 'primary';

    // Fetch events from Google Calendar
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    const gcalResp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      },
    );

    if (!gcalResp.ok) {
      const errText = await gcalResp.text();
      console.error('GCal list failed:', errText);
      return jsonResponse({ error: 'Failed to fetch Google Calendar events' }, { status: 500 });
    }

    const gcalData = await gcalResp.json();
    const items = gcalData.items ?? [];

    // Map to a simplified shape for the frontend
    const events = items.map((item: any) => ({
      id: item.id,
      summary: item.summary ?? '(No title)',
      description: item.description ?? null,
      location: item.location ?? null,
      start: item.start?.dateTime ?? item.start?.date ?? null,
      end: item.end?.dateTime ?? item.end?.date ?? null,
      htmlLink: item.htmlLink ?? null,
      status: item.status,
    }));

    return jsonResponse({ events });
  } catch (error: unknown) {
    console.error('Error in gcal-list-events:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, { status: 500 });
  }
});
