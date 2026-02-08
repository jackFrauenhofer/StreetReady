import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

function findDailyAvailability(
  busyIntervals: { start: string; end: string }[],
  year: number,
  month: number,
  dayOfMonth: number,
): string[] {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const results: string[] = [];
  const ET_OFFSET = 5; // EST = UTC-5 (use 4 for EDT)
  const WINDOW_START = 9;  // 9am ET
  const WINDOW_END = 22;   // 10pm ET

  // Anchor on the client's local date
  const anchor = new Date(Date.UTC(year, month - 1, dayOfMonth, 12, 0, 0));
  let weekdaysFound = 0;

  // Pre-parse all busy intervals into UTC millisecond pairs
  const busyMs = busyIntervals.map((b) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));

  console.log(`findDailyAvailability: anchor=${anchor.toISOString()}, busyIntervals=${busyMs.length}`);

  for (let d = 1; weekdaysFound < 5 && d <= 14; d++) {
    const day = new Date(anchor);
    day.setUTCDate(day.getUTCDate() + d);

    const dow = day.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    weekdaysFound++;

    const yy = day.getUTCFullYear();
    const mm = day.getUTCMonth(); // 0-indexed
    const dd = day.getUTCDate();

    // For each ET hour h, the UTC equivalent is h + ET_OFFSET
    // e.g. 9am ET = 14:00 UTC (when EST)
    const busyHours = new Set<number>();

    for (let h = WINDOW_START; h < WINDOW_END; h++) {
      const slotStartUtc = Date.UTC(yy, mm, dd, h + ET_OFFSET, 0, 0);
      const slotEndUtc = Date.UTC(yy, mm, dd, h + ET_OFFSET + 1, 0, 0);

      for (const b of busyMs) {
        if (b.start < slotEndUtc && b.end > slotStartUtc) {
          busyHours.add(h);
          break;
        }
      }
    }

    console.log(`  ${dayNames[dow]} ${mm+1}/${dd}: busyHours=[${[...busyHours].sort((a,b)=>a-b).join(',')}]`);

    // Build free ranges from non-busy hours
    const freeRanges: { start: number; end: number }[] = [];
    let rangeStart: number | null = null;

    for (let h = WINDOW_START; h < WINDOW_END; h++) {
      if (!busyHours.has(h)) {
        if (rangeStart === null) rangeStart = h;
      } else {
        if (rangeStart !== null) {
          freeRanges.push({ start: rangeStart, end: h });
          rangeStart = null;
        }
      }
    }
    if (rangeStart !== null) {
      freeRanges.push({ start: rangeStart, end: WINDOW_END });
    }

    if (freeRanges.length === 0) continue;

    const dayLabel = `${dayNames[dow]} (${mm + 1}/${dd})`;

    if (freeRanges.length === 1 && freeRanges[0].start === WINDOW_START && freeRanges[0].end === WINDOW_END) {
      results.push(`${dayLabel}: ${formatHour(WINDOW_START)} - ${formatHour(WINDOW_END)} ET`);
    } else {
      const rangeStrs = freeRanges.map((r) => `${formatHour(r.start)} - ${formatHour(r.end)}`);
      results.push(`${dayLabel}: ${rangeStrs.join('; ')} ET`);
    }
  }

  return results;
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
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';

    if (!openaiApiKey) {
      return jsonResponse({ error: 'Missing OPENAI_API_KEY secret' }, { status: 500 });
    }

    // Authenticate user
    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
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

    const { contactId, clientYear, clientMonth, clientDay } = await req.json();
    if (!contactId || typeof contactId !== 'string') {
      return jsonResponse({ error: 'Missing contactId' }, { status: 400 });
    }

    // Fetch contact
    const { data: contact, error: contactErr } = await supabaseAdmin
      .from('contacts')
      .select('id, user_id, name, firm, group_name, position, connection_type, email')
      .eq('id', contactId)
      .single();

    if (contactErr || !contact) {
      return jsonResponse({ error: 'Contact not found' }, { status: 404 });
    }
    if (contact.user_id !== userId) {
      return jsonResponse({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('school, graduation_year, email')
      .eq('user_id', userId)
      .single();

    // Fetch resume for name and major
    const { data: resume } = await supabaseAdmin
      .from('user_resumes')
      .select('parsed_resume_json')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const resumeSummary = (resume?.parsed_resume_json as any)?.summary ?? (resume?.parsed_resume_json as any) ?? {};
    const userName = resumeSummary.name || profile?.email?.split('@')[0] || 'there';
    const userSchool = resumeSummary.school || profile?.school || '';
    const userMajor = resumeSummary.major || '';
    const gradYear = resumeSummary.graduation_year || profile?.graduation_year || '';

    // Compute calendar availability lines in code (never trust GPT with dates)
    let availabilityLines: string[] = [];
    // Default: use client date to compute next 5 weekdays with full availability
    const cy = clientYear || new Date().getUTCFullYear();
    const cm = clientMonth || (new Date().getUTCMonth() + 1);
    const cd = clientDay || new Date().getUTCDate();

    const { data: tokenRow } = await supabaseAdmin
      .from('user_google_tokens')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (tokenRow && googleClientId && googleClientSecret) {
      try {
        let googleAccessToken = tokenRow.access_token;
        const expiresAt = new Date(tokenRow.token_expires_at).getTime();
        if (Date.now() > expiresAt - 60_000) {
          const refreshed = await refreshAccessToken(tokenRow.refresh_token, googleClientId, googleClientSecret);
          if (refreshed) {
            googleAccessToken = refreshed.access_token;
            const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
            await supabaseAdmin
              .from('user_google_tokens')
              .update({ access_token: googleAccessToken, token_expires_at: newExpiry })
              .eq('user_id', userId);
          }
        }

        const anchor = new Date(Date.UTC(cy, cm - 1, cd, 12, 0, 0));
        const future = new Date(anchor.getTime() + 14 * 24 * 60 * 60 * 1000);
        const calendarId = tokenRow.calendar_id || 'primary';

        const params = new URLSearchParams({
          timeMin: anchor.toISOString(),
          timeMax: future.toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '250',
        });

        const gcalResp = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
          { headers: { Authorization: `Bearer ${googleAccessToken}` } },
        );

        if (gcalResp.ok) {
          const gcalData = await gcalResp.json();
          const items = gcalData.items ?? [];
          console.log(`GCal returned ${items.length} total items`);
          const busyIntervals = items
            .filter((item: any) => item.status !== 'cancelled' && item.start?.dateTime && item.end?.dateTime)
            .map((item: any) => ({
              start: item.start.dateTime,
              end: item.end.dateTime,
            }));

          console.log(`Filtered to ${busyIntervals.length} busy intervals:`, JSON.stringify(busyIntervals.slice(0, 10)));
          availabilityLines = findDailyAvailability(busyIntervals, cy, cm, cd);
        }
      } catch (e) {
        console.warn('Failed to fetch calendar availability:', e);
      }
    }

    // If no gcal or no results, generate default availability (all day free for next 5 weekdays)
    if (availabilityLines.length === 0) {
      availabilityLines = findDailyAvailability([], cy, cm, cd);
    }

    // Build the availability block that will be injected into the email (NOT generated by GPT)
    const availabilityBlock = availabilityLines.join('\n');
    console.log('Computed availability block:', availabilityBlock);

    // Build the prompt
    const contactDesc = [
      contact.name,
      contact.position && `(${contact.position})`,
      contact.firm && `at ${contact.firm}`,
      contact.group_name && `in ${contact.group_name}`,
    ].filter(Boolean).join(' ');

    const userIntro = [
      userName,
      userSchool && `at ${userSchool}`,
      userMajor && `studying ${userMajor}`,
      gradYear && `(Class of ${gradYear})`,
    ].filter(Boolean).join(' ');

    const connectionNote = contact.connection_type === 'alumni'
      ? `The contact is an alumni of the user's school.`
      : contact.connection_type === 'referral'
      ? `The user was referred to this contact.`
      : contact.connection_type === 'friend'
      ? `The contact is a personal connection.`
      : `This is a cold outreach.`;

    const prompt = `Write a short, professional networking email (6-8 sentences max) from ${userIntro} to ${contactDesc}.

Context:
- ${connectionNote}
- The user is interested in Investment Banking${contact.firm ? ` at ${contact.firm}` : ''}${contact.group_name ? ` (${contact.group_name})` : ''}.
- The user would appreciate a 20-minute phone call to learn more.

Guidelines:
- Keep it concise and professional but warm.
- Introduce yourself briefly (name, school, major, class year).
- Express genuine interest in the firm/group.
- Ask for a 20-minute phone call.
- Where you want to mention your availability, write EXACTLY the placeholder text {{AVAILABILITY}} on its own line. Do NOT write any dates, times, or days yourself. The system will replace this placeholder with the real availability.
- Start the email with "Hi ${contact.name.split(' ')[0]}," (first name only).
- End with "Best,\n${userName}" as the sign-off. Do NOT use any other greeting or sign-off.
- Do NOT use placeholder brackets like [Your Name] — use the actual information provided.
- Do NOT invent or guess any dates or times. Only use {{AVAILABILITY}} as the placeholder.

Return STRICT JSON: { "subject": "...", "body": "..." }
- subject: a short email subject line
- body: the full email text (use \\n for line breaks). Include {{AVAILABILITY}} where the time slots should go.
- Return valid JSON only, no markdown fencing.`;

    const chatResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.6,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!chatResp.ok) {
      const errText = await chatResp.text();
      console.error('OpenAI error:', errText);
      return jsonResponse({ error: 'Failed to generate email' }, { status: 500 });
    }

    const chatJson = await chatResp.json();
    const content = chatJson?.choices?.[0]?.message?.content;

    if (!content) {
      return jsonResponse({ error: 'No content in response' }, { status: 500 });
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse JSON:', content);
      return jsonResponse({ error: 'Invalid response format' }, { status: 500 });
    }

    // Replace the placeholder with the real availability computed by our code
    let finalBody = (parsed?.body || '').toString();
    const availReplacement = availabilityBlock + '\nHappy to work around your schedule as well.';
    if (finalBody.includes('{{AVAILABILITY}}')) {
      finalBody = finalBody.replace('{{AVAILABILITY}}', availReplacement);
    } else {
      // GPT didn't include the placeholder — append availability at the end before sign-off
      const signOffIdx = finalBody.lastIndexOf('Best,');
      if (signOffIdx > 0) {
        finalBody = finalBody.slice(0, signOffIdx) + '\n' + availReplacement + '\n\n' + finalBody.slice(signOffIdx);
      } else {
        finalBody += '\n\n' + availReplacement;
      }
    }

    return jsonResponse({
      subject: parsed?.subject || 'Networking Introduction',
      body: finalBody,
    });
  } catch (error: unknown) {
    console.error('Error in generate-outreach-email:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, { status: 500 });
  }
});
