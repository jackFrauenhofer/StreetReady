import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Sync Google Calendar call events into the StreetReady pipeline.
 *
 * Body: { timeMin: string (ISO), timeMax: string (ISO) }
 *
 * For each upcoming GCal event with attendees:
 *  1. Skip if already synced (external_event_id exists in call_events)
 *  2. For each non-self attendee email, find or create a contact
 *  3. Create a call_event linked to that contact
 *  4. Move the contact to 'scheduled' stage
 *
 * Returns: { synced: number, skipped: number, pending_contacts: PendingContact[] }
 * 
 * pending_contacts contains unmatched attendees for the user to review before creating.
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
    const userEmail = userData.user.email?.toLowerCase();

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

    // Refresh token if expired
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
      { headers: { Authorization: `Bearer ${googleAccessToken}` } },
    );

    if (!gcalResp.ok) {
      const errText = await gcalResp.text();
      console.error('GCal list failed:', errText);
      return jsonResponse({ error: 'Failed to fetch Google Calendar events' }, { status: 500 });
    }

    const gcalData = await gcalResp.json();
    const items: any[] = gcalData.items ?? [];

    // Get existing synced event IDs to avoid duplicates
    const { data: existingSynced } = await supabaseAdmin
      .from('call_events')
      .select('external_event_id')
      .eq('user_id', userId)
      .eq('external_provider', 'google');

    const syncedIds = new Set((existingSynced ?? []).map((e: any) => e.external_event_id));

    // Get all user's contacts for email matching
    const { data: existingContacts } = await supabaseAdmin
      .from('contacts')
      .select('id, email, name')
      .eq('user_id', userId);

    const contactsByEmail = new Map<string, { id: string; name: string }>();
    (existingContacts ?? []).forEach((c: any) => {
      if (c.email) {
        contactsByEmail.set(c.email.toLowerCase(), { id: c.id, name: c.name });
      }
    });

    let synced = 0;
    let skipped = 0;

    const stageOrder = ['researching', 'messaged', 'scheduled', 'call_done', 'strong_connection', 'referral_requested', 'interview', 'offer'];

    // Collect unmatched attendees for user review (deduped by email)
    const pendingContactsMap = new Map<string, {
      email: string;
      displayName: string;
      gcalEventId: string;
      eventTitle: string;
      startAt: string;
      endAt: string;
      location: string | null;
      notes: string | null;
    }>();

    for (const item of items) {
      // Skip cancelled events
      if (item.status === 'cancelled') {
        skipped++;
        continue;
      }

      // Skip already synced events
      if (syncedIds.has(item.id)) {
        skipped++;
        continue;
      }

      // Get attendees (exclude self)
      const attendees: any[] = item.attendees ?? [];
      const otherAttendees = attendees.filter(
        (a: any) => !a.self && a.email?.toLowerCase() !== userEmail,
      );

      // Skip events with no other attendees (solo events, focus time, etc.)
      if (otherAttendees.length === 0) {
        skipped++;
        continue;
      }

      const startAt = item.start?.dateTime ?? item.start?.date ?? new Date().toISOString();
      const endAt = item.end?.dateTime ?? item.end?.date ?? startAt;

      // Process each attendee
      for (const attendee of otherAttendees) {
        const email = attendee.email?.toLowerCase();
        if (!email) continue;

        // Check if contact exists
        const existing = contactsByEmail.get(email);
        if (existing) {
          // Auto-sync: create call_event for existing contact
          const { error: callErr } = await supabaseAdmin
            .from('call_events')
            .insert({
              user_id: userId,
              contact_id: existing.id,
              title: item.summary ?? '(No title)',
              start_at: startAt,
              end_at: endAt,
              location: item.location ?? null,
              notes: item.description ?? null,
              status: 'scheduled',
              external_provider: 'google',
              external_event_id: item.id,
            });

          if (callErr) {
            console.error('Failed to create call_event for', item.id, callErr);
            continue;
          }

          // Move contact to 'scheduled' stage only if not already past it
          const { data: contactRow } = await supabaseAdmin
            .from('contacts')
            .select('stage')
            .eq('id', existing.id)
            .single();

          if (contactRow) {
            const currentIdx = stageOrder.indexOf(contactRow.stage);
            const scheduledIdx = stageOrder.indexOf('scheduled');
            if (currentIdx < scheduledIdx) {
              await supabaseAdmin
                .from('contacts')
                .update({ stage: 'scheduled' })
                .eq('id', existing.id);
            }
          }

          synced++;
        } else {
          // Unmatched: collect for user review (don't auto-create)
          if (!pendingContactsMap.has(email)) {
            pendingContactsMap.set(email, {
              email,
              displayName: attendee.displayName || email.split('@')[0],
              gcalEventId: item.id,
              eventTitle: item.summary ?? '(No title)',
              startAt,
              endAt,
              location: item.location ?? null,
              notes: item.description ?? null,
            });
          }
        }
      }

      // Mark this GCal event ID as synced (for matched contacts)
      // Don't mark pending ones — they'll be synced after user confirms
      if (!pendingContactsMap.has(item.id)) {
        syncedIds.add(item.id);
      }
    }

    const pendingContacts = Array.from(pendingContactsMap.values());

    return jsonResponse({ synced, skipped, pending_contacts: pendingContacts });
  } catch (error: unknown) {
    console.error('Error in gcal-sync-calls:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, { status: 500 });
  }
});
