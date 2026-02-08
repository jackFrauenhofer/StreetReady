import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Push a call event to Google Calendar (create / update / delete).
 *
 * Body: { callEventId: string, action: 'create' | 'update' | 'delete' }
 *
 * - Reads the call_event row from DB
 * - Reads the user's stored Google tokens
 * - Refreshes the access token if expired
 * - Calls the Google Calendar API
 * - Stores the external_event_id back on the call_event row
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
    const { callEventId, action, attendeeEmail } = await req.json();
    if (!callEventId || !action) {
      return jsonResponse({ error: 'Missing callEventId or action' }, { status: 400 });
    }
    if (!['create', 'update', 'delete'].includes(action)) {
      return jsonResponse({ error: 'Invalid action' }, { status: 400 });
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

    // Get call event
    const { data: callEvent, error: callErr } = await supabaseAdmin
      .from('call_events')
      .select('*, contact:contacts(name, firm)')
      .eq('id', callEventId)
      .single();

    if (callErr || !callEvent) {
      return jsonResponse({ error: 'Call event not found' }, { status: 404 });
    }

    if (callEvent.user_id !== userId) {
      return jsonResponse({ error: 'Forbidden' }, { status: 403 });
    }

    const calendarId = tokenRow.calendar_id || 'primary';
    const gcalBase = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    // Build Google Calendar event body
    const contact = callEvent.contact as { name: string; firm: string | null } | null;
    const description = [
      callEvent.notes,
      contact ? `Contact: ${contact.name}${contact.firm ? ` (${contact.firm})` : ''}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    const gcalEvent: Record<string, unknown> = {
      summary: callEvent.title,
      description,
      location: callEvent.location || undefined,
      start: {
        dateTime: callEvent.start_at,
        timeZone: 'UTC',
      },
      end: {
        dateTime: callEvent.end_at,
        timeZone: 'UTC',
      },
    };

    // Add attendee if email provided — Google will send them a calendar invite
    if (attendeeEmail && typeof attendeeEmail === 'string') {
      gcalEvent.attendees = [{ email: attendeeEmail }];
      console.log('Adding attendee:', attendeeEmail);
    } else {
      console.log('No attendeeEmail provided, value was:', attendeeEmail);
    }

    const gcalHeaders = {
      Authorization: `Bearer ${googleAccessToken}`,
      'Content-Type': 'application/json',
    };

    let result: any = null;

    if (action === 'create') {
      // sendUpdates=all tells Google to email invites to attendees
      const url = attendeeEmail
        ? `${gcalBase}?sendUpdates=all`
        : gcalBase;
      console.log('Creating gcal event at:', url, 'body:', JSON.stringify(gcalEvent));
      const resp = await fetch(url, {
        method: 'POST',
        headers: gcalHeaders,
        body: JSON.stringify(gcalEvent),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.error('GCal create failed:', errText);
        return jsonResponse({ error: 'Failed to create Google Calendar event' }, { status: 500 });
      }
      result = await resp.json();

      // Store external_event_id
      await supabaseAdmin
        .from('call_events')
        .update({ external_provider: 'google', external_event_id: result.id })
        .eq('id', callEventId);

    } else if (action === 'update') {
      const externalId = callEvent.external_event_id;
      if (!externalId) {
        // No GCal event yet — create instead
        const uUrl = attendeeEmail ? `${gcalBase}?sendUpdates=all` : gcalBase;
        const resp = await fetch(uUrl, {
          method: 'POST',
          headers: gcalHeaders,
          body: JSON.stringify(gcalEvent),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error('GCal create (on update) failed:', errText);
          return jsonResponse({ error: 'Failed to create Google Calendar event' }, { status: 500 });
        }
        result = await resp.json();
        await supabaseAdmin
          .from('call_events')
          .update({ external_provider: 'google', external_event_id: result.id })
          .eq('id', callEventId);
      } else {
        const pUrl = attendeeEmail
          ? `${gcalBase}/${encodeURIComponent(externalId)}?sendUpdates=all`
          : `${gcalBase}/${encodeURIComponent(externalId)}`;
        const resp = await fetch(pUrl, {
          method: 'PUT',
          headers: gcalHeaders,
          body: JSON.stringify(gcalEvent),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error('GCal update failed:', errText);
          return jsonResponse({ error: 'Failed to update Google Calendar event' }, { status: 500 });
        }
        result = await resp.json();
      }

    } else if (action === 'delete') {
      const externalId = callEvent.external_event_id;
      if (externalId) {
        const resp = await fetch(`${gcalBase}/${encodeURIComponent(externalId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${googleAccessToken}` },
        });
        if (!resp.ok && resp.status !== 404 && resp.status !== 410) {
          const errText = await resp.text();
          console.error('GCal delete failed:', errText);
          return jsonResponse({ error: 'Failed to delete Google Calendar event' }, { status: 500 });
        }
        // Clear external references
        await supabaseAdmin
          .from('call_events')
          .update({ external_provider: null, external_event_id: null })
          .eq('id', callEventId);
      }
      result = { deleted: true };
    }

    return jsonResponse({ success: true, gcalEventId: result?.id ?? null });
  } catch (error: unknown) {
    console.error('Error in gcal-push-event:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, { status: 500 });
  }
});
