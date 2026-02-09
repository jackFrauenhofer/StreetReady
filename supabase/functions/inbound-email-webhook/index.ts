import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Google Token Refresh ─────────────────────────────────────────────────────

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

// ─── Google Calendar Push ─────────────────────────────────────────────────────

async function pushToGoogleCalendar(opts: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  callEventId: string;
  callEvent: { title: string; start_at: string; end_at: string; location: string | null; notes: string | null };
  contactName: string;
  contactFirm: string | null;
  attendeeEmail: string | null;
  clientId: string;
  clientSecret: string;
}): Promise<{ success: boolean; gcalEventId?: string; error?: string }> {
  // Get user's Google tokens
  const { data: tokenRow, error: tokenErr } = await opts.supabase
    .from('user_google_tokens')
    .select('*')
    .eq('user_id', opts.userId)
    .single();

  if (tokenErr || !tokenRow) {
    return { success: false, error: 'Google Calendar not connected' };
  }

  // Refresh token if expired (with 60s buffer)
  let googleAccessToken = tokenRow.access_token;
  const expiresAt = new Date(tokenRow.token_expires_at).getTime();
  if (Date.now() > expiresAt - 60_000) {
    const refreshed = await refreshAccessToken(tokenRow.refresh_token, opts.clientId, opts.clientSecret);
    if (!refreshed) {
      return { success: false, error: 'Failed to refresh Google token' };
    }
    googleAccessToken = refreshed.access_token;
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await opts.supabase
      .from('user_google_tokens')
      .update({ access_token: googleAccessToken, token_expires_at: newExpiry })
      .eq('user_id', opts.userId);
  }

  const calendarId = tokenRow.calendar_id || 'primary';
  const gcalBase = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  // Build Google Calendar event body
  const description = [
    opts.callEvent.notes,
    `Contact: ${opts.contactName}${opts.contactFirm ? ` (${opts.contactFirm})` : ''}`,
  ].filter(Boolean).join('\n\n');

  const gcalEvent: Record<string, unknown> = {
    summary: opts.callEvent.title,
    description,
    location: opts.callEvent.location || undefined,
    start: { dateTime: opts.callEvent.start_at, timeZone: 'UTC' },
    end: { dateTime: opts.callEvent.end_at, timeZone: 'UTC' },
  };

  // Add attendee — Google will send them a calendar invite from the user's account
  if (opts.attendeeEmail) {
    gcalEvent.attendees = [{ email: opts.attendeeEmail }];
  }

  const url = opts.attendeeEmail ? `${gcalBase}?sendUpdates=all` : gcalBase;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${googleAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(gcalEvent),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error('GCal create failed:', errText);
    return { success: false, error: `GCal API error: ${resp.status}` };
  }

  const result = await resp.json();

  // Store external_event_id on the call_event
  await opts.supabase
    .from('call_events')
    .update({ external_provider: 'google', external_event_id: result.id })
    .eq('id', opts.callEventId);

  return { success: true, gcalEventId: result.id };
}

// ─── LLM Extraction ──────────────────────────────────────────────────────────

interface ParsedScheduling {
  has_scheduling_intent: boolean;
  confidence: 'high' | 'medium' | 'low';
  proposed_datetime: string | null;
  timezone: string | null;
  recruiter_name: string | null;
  recruiter_email: string | null;
  firm: string | null;
  position: string | null;
  meeting_type: 'phone' | 'video' | 'in_person' | null;
  notes: string | null;
}

async function extractSchedulingIntent(
  openaiApiKey: string,
  subject: string,
  bodyText: string,
): Promise<ParsedScheduling> {
  const truncatedBody = bodyText.slice(0, 4000);

  const prompt = `Analyze this forwarded email and extract scheduling information.

Subject: ${subject}
Body:
${truncatedBody}

Extract the following as JSON:
- has_scheduling_intent (bool): Does this email propose or confirm a specific meeting/call/interview?
- confidence ("high" | "medium" | "low"): How confident are you about the scheduling intent and extracted datetime?
  - "high": A specific date AND time are clearly stated (e.g. "Tuesday Jan 14 at 2pm EST")
  - "medium": A date is mentioned but time is vague, or multiple options are given
  - "low": Vague references to meeting but no specific datetime
- proposed_datetime (ISO 8601 string or null): The proposed meeting date/time. Convert to ISO 8601. If multiple times are offered, pick the first one. If no specific time, use null.
- timezone (string or null): The timezone mentioned or implied (e.g. "America/New_York", "EST", "PST"). Default to "America/New_York" if a US-based company and no timezone specified.
- recruiter_name (string or null): The name of the person proposing the meeting (the recruiter/contact, NOT the person who forwarded)
- recruiter_email (string or null): Their email address if visible
- firm (string or null): The company/firm name
- position (string or null): The role/position being discussed
- meeting_type ("phone" | "video" | "in_person" | null): Type of meeting if mentioned
- notes (string or null): Brief summary of what the meeting is about

Return STRICT JSON only, no markdown fencing.`;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error('OpenAI error:', errText);
    throw new Error(`OpenAI API error: ${resp.status}`);
  }

  const json = await resp.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content in OpenAI response');

  return JSON.parse(content) as ParsedScheduling;
}

// ─── SendGrid Inbound Parse Payload Parser ────────────────────────────────────

interface InboundEmail {
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  envelope: { from: string; to: string[] } | null;
}

async function parseSendGridPayload(req: Request): Promise<InboundEmail> {
  const contentType = req.headers.get('content-type') || '';

  let from = '';
  let to = '';
  let subject = '';
  let text = '';
  let html = '';
  let envelopeStr = '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    from = (formData.get('from') as string) || '';
    to = (formData.get('to') as string) || '';
    subject = (formData.get('subject') as string) || '';
    text = (formData.get('text') as string) || '';
    html = (formData.get('html') as string) || '';
    envelopeStr = (formData.get('envelope') as string) || '';
  } else {
    // Fallback: JSON body
    const body = await req.json();
    from = body.from || '';
    to = body.to || '';
    subject = body.subject || '';
    text = body.text || '';
    html = body.html || '';
    envelopeStr = typeof body.envelope === 'string' ? body.envelope : JSON.stringify(body.envelope || {});
  }

  // Extract email from "Name <email>" format
  const emailMatch = from.match(/<([^>]+)>/);
  const fromEmail = emailMatch ? emailMatch[1].toLowerCase() : from.toLowerCase().trim();

  let envelope: { from: string; to: string[] } | null = null;
  try {
    if (envelopeStr) envelope = JSON.parse(envelopeStr);
  } catch { /* ignore */ }

  return { from, fromEmail, to, subject, text, html, envelope };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const webhookSecret = Deno.env.get('INBOUND_WEBHOOK_SECRET');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Optional: validate webhook secret
    if (webhookSecret) {
      const providedSecret = req.headers.get('x-webhook-secret');
      if (providedSecret !== webhookSecret) {
        console.warn('Invalid webhook secret');
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
    }

    // Parse the inbound email
    const email = await parseSendGridPayload(req);
    console.log(`Inbound email from: ${email.fromEmail}, subject: ${email.subject}`);

    // Look up user by sender email
    const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
    if (userErr) {
      console.error('Failed to list users:', userErr);
      throw new Error('Failed to look up users');
    }

    const matchedUser = users.users.find(
      (u: { email?: string }) => u.email?.toLowerCase() === email.fromEmail,
    );

    if (!matchedUser) {
      console.log(`No user found for email: ${email.fromEmail}`);
      await supabase.from('inbound_emails').insert({
        user_id: null,
        from_address: email.fromEmail,
        to_address: email.to,
        subject: email.subject,
        body_text: email.text?.slice(0, 50000),
        body_html: email.html?.slice(0, 50000),
        raw_payload: { from: email.from, to: email.to, subject: email.subject, envelope: email.envelope },
        status: 'ignored',
        error_message: 'No matching user found',
      });
      return jsonResponse({ message: 'No matching user, email ignored' });
    }

    const userId = matchedUser.id;
    console.log(`Matched user: ${userId}`);

    if (!openaiApiKey) {
      await supabase.from('inbound_emails').insert({
        user_id: userId,
        from_address: email.fromEmail,
        to_address: email.to,
        subject: email.subject,
        body_text: email.text?.slice(0, 50000),
        body_html: email.html?.slice(0, 50000),
        raw_payload: { from: email.from, to: email.to, subject: email.subject, envelope: email.envelope },
        status: 'failed',
        error_message: 'Missing OPENAI_API_KEY',
      });
      return jsonResponse({ error: 'Server misconfiguration' }, 500);
    }

    // Extract scheduling intent via LLM
    const parsed = await extractSchedulingIntent(
      openaiApiKey,
      email.subject || '(no subject)',
      email.text || email.html || '',
    );
    console.log('Parsed scheduling:', JSON.stringify(parsed));

    // Determine if we can auto-schedule
    const canAutoSchedule =
      parsed.has_scheduling_intent &&
      parsed.confidence === 'high' &&
      parsed.proposed_datetime;

    // Find or create contact
    let contactId: string | null = null;
    const recruiterEmail = parsed.recruiter_email?.toLowerCase() || null;
    const recruiterName = parsed.recruiter_name || 'Unknown Contact';

    if (recruiterEmail) {
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', userId)
        .ilike('email', recruiterEmail)
        .limit(1)
        .maybeSingle();
      if (existingContact) contactId = existingContact.id;
    }

    if (!contactId && recruiterName !== 'Unknown Contact') {
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', recruiterName)
        .limit(1)
        .maybeSingle();
      if (existingContact) contactId = existingContact.id;
    }

    if (!contactId && (recruiterEmail || recruiterName !== 'Unknown Contact')) {
      const { data: newContact, error: contactErr } = await supabase
        .from('contacts')
        .insert({
          user_id: userId,
          name: recruiterName,
          email: recruiterEmail,
          firm: parsed.firm || null,
          position: parsed.position || null,
          connection_type: 'cold',
          relationship_strength: 1,
          stage: 'researching',
          next_followup_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single();
      if (contactErr) {
        console.error('Failed to create contact:', contactErr);
      } else {
        contactId = newContact.id;
      }
    }

    let callEventId: string | null = null;
    let gcalPushed = false;

    // Look up user's profile name for meeting titles
    let userName: string | null = null;
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('name')
      .eq('user_id', userId)
      .single();
    if (profileRow?.name) userName = profileRow.name;

    if (canAutoSchedule && contactId) {
      // ── High confidence: auto-schedule ──
      const startDate = new Date(parsed.proposed_datetime!);
      const endDate = new Date(startDate.getTime() + 30 * 60 * 1000); // 30 min default

      const meetingTitle = userName
        ? `${userName} <> ${recruiterName} Phone Call`
        : `Call with ${recruiterName}`;

      // Create call event
      const { data: callEvent, error: callErr } = await supabase
        .from('call_events')
        .insert({
          user_id: userId,
          contact_id: contactId,
          title: meetingTitle,
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
          location: parsed.meeting_type === 'in_person' ? (parsed.notes || null) : null,
          notes: parsed.notes || `Auto-scheduled from forwarded email: ${email.subject}`,
          status: 'scheduled',
        })
        .select('id')
        .single();

      if (callErr) {
        console.error('Failed to create call event:', callErr);
      } else {
        callEventId = callEvent.id;

        // Update contact stage to scheduled
        await supabase
          .from('contacts')
          .update({ stage: 'scheduled', last_contacted_at: new Date().toISOString() })
          .eq('id', contactId);

        // Create interaction
        await supabase.from('interactions').insert({
          user_id: userId,
          contact_id: contactId,
          type: 'email',
          date: new Date().toISOString(),
          notes: `Forwarded scheduling email: ${email.subject}`,
        });

        // Push to Google Calendar (sends invite to recruiter from user's own GCal)
        if (googleClientId && googleClientSecret) {
          const gcalResult = await pushToGoogleCalendar({
            supabase,
            userId,
            callEventId: callEvent.id,
            callEvent: {
              title: meetingTitle,
              start_at: startDate.toISOString(),
              end_at: endDate.toISOString(),
              location: null,
              notes: parsed.notes || `Auto-scheduled from forwarded email: ${email.subject}`,
            },
            contactName: recruiterName,
            contactFirm: parsed.firm || null,
            attendeeEmail: recruiterEmail,
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          });

          if (gcalResult.success) {
            gcalPushed = true;
            console.log('Pushed to Google Calendar, event ID:', gcalResult.gcalEventId);
          } else {
            console.warn('GCal push failed:', gcalResult.error);
          }
        } else {
          console.warn('Google Calendar credentials not set, skipping GCal push');
        }
      }

      // Store inbound email record
      await supabase.from('inbound_emails').insert({
        user_id: userId,
        from_address: email.fromEmail,
        to_address: email.to,
        subject: email.subject,
        body_text: email.text?.slice(0, 50000),
        body_html: email.html?.slice(0, 50000),
        raw_payload: { from: email.from, to: email.to, subject: email.subject, envelope: email.envelope },
        parsed_result: parsed,
        status: 'processed',
        contact_id: contactId,
        call_event_id: callEventId,
      });

      return jsonResponse({
        message: 'Email processed and meeting scheduled',
        contact_id: contactId,
        call_event_id: callEventId,
        gcal_pushed: gcalPushed,
      });
    } else {
      // ── Low/medium confidence: needs confirmation ──
      if (contactId) {
        await supabase.from('tasks').insert({
          user_id: userId,
          title: `Confirm scheduling: ${email.subject || '(no subject)'}`.slice(0, 200),
          contact_id: contactId,
          due_date: new Date().toISOString().split('T')[0],
        });

        await supabase.from('interactions').insert({
          user_id: userId,
          contact_id: contactId,
          type: 'email',
          date: new Date().toISOString(),
          notes: `Forwarded email (needs confirmation): ${email.subject}`,
        });
      }

      await supabase.from('inbound_emails').insert({
        user_id: userId,
        from_address: email.fromEmail,
        to_address: email.to,
        subject: email.subject,
        body_text: email.text?.slice(0, 50000),
        body_html: email.html?.slice(0, 50000),
        raw_payload: { from: email.from, to: email.to, subject: email.subject, envelope: email.envelope },
        parsed_result: parsed,
        status: 'needs_confirmation',
        contact_id: contactId,
      });

      return jsonResponse({
        message: 'Email received, needs manual confirmation',
        contact_id: contactId,
        confidence: parsed.confidence,
      });
    }
  } catch (error: unknown) {
    console.error('Error in inbound-email-webhook:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    try {
      await supabase.from('inbound_emails').insert({
        from_address: 'unknown',
        status: 'failed',
        error_message: message,
        raw_payload: { error: message },
      });
    } catch { /* best effort */ }

    // Always return 200 to SendGrid to prevent retries
    return jsonResponse({ error: message });
  }
});
