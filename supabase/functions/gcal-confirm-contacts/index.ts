import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Create confirmed contacts and their call events after user review.
 *
 * Body: { contacts: ConfirmedContact[] }
 *
 * Each ConfirmedContact:
 *   name: string
 *   email: string
 *   firm?: string
 *   position?: string
 *   connection_type: 'cold' | 'alumni' | 'friend' | 'referral'
 *   gcalEventId: string
 *   eventTitle: string
 *   startAt: string
 *   endAt: string
 *   location?: string
 *   notes?: string
 *
 * Returns: { created: number }
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

    const { contacts } = await req.json();
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return jsonResponse({ error: 'No contacts provided' }, { status: 400 });
    }

    let created = 0;

    for (const c of contacts) {
      // Create the contact
      const { data: newContact, error: createErr } = await supabaseAdmin
        .from('contacts')
        .insert({
          user_id: userId,
          name: c.name,
          email: c.email,
          firm: c.firm || null,
          position: c.position || null,
          connection_type: c.connection_type || 'cold',
          relationship_strength: 1,
          stage: 'scheduled',
        })
        .select('id')
        .single();

      if (createErr) {
        console.error('Failed to create contact for', c.email, createErr);
        continue;
      }

      // Create the call_event
      const { error: callErr } = await supabaseAdmin
        .from('call_events')
        .insert({
          user_id: userId,
          contact_id: newContact.id,
          title: c.eventTitle,
          start_at: c.startAt,
          end_at: c.endAt,
          location: c.location || null,
          notes: c.notes || null,
          status: 'scheduled',
          external_provider: 'google',
          external_event_id: c.gcalEventId,
        });

      if (callErr) {
        console.error('Failed to create call_event for', c.gcalEventId, callErr);
        continue;
      }

      created++;
    }

    return jsonResponse({ created });
  } catch (error: unknown) {
    console.error('Error in gcal-confirm-contacts:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, { status: 500 });
  }
});
