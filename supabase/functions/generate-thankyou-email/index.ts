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

    const { contactId } = await req.json();
    if (!contactId || typeof contactId !== 'string') {
      return jsonResponse({ error: 'Missing contactId' }, { status: 400 });
    }

    // Fetch contact
    const { data: contact, error: contactErr } = await supabaseAdmin
      .from('contacts')
      .select('id, user_id, name, firm, group_name, position, connection_type, email, notes_summary, prep_questions_json')
      .eq('id', contactId)
      .single();

    if (contactErr || !contact) {
      return jsonResponse({ error: 'Contact not found' }, { status: 404 });
    }
    if (contact.user_id !== userId) {
      return jsonResponse({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the most recent completed call event for this contact
    const { data: callEvent } = await supabaseAdmin
      .from('call_events')
      .select('id, title, start_at, notes')
      .eq('contact_id', contactId)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('start_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch recent interactions for context
    const { data: interactions } = await supabaseAdmin
      .from('interactions')
      .select('type, date, notes')
      .eq('contact_id', contactId)
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(5);

    // Fetch user profile
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

    // Build context sections
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
    ].filter(Boolean).join(' ');

    // Prep questions
    const prepQuestions = Array.isArray(contact.prep_questions_json)
      ? (contact.prep_questions_json as { text: string }[]).map((q) => q.text)
      : [];

    // Call notes
    const callNotes = callEvent?.notes || null;

    // Interaction notes
    const interactionNotes = (interactions || [])
      .filter((i: any) => i.notes)
      .map((i: any) => `${i.type} (${i.date}): ${i.notes}`)
      .slice(0, 3);

    // Contact notes summary
    const contactNotes = contact.notes_summary || null;

    // Build the prompt
    let contextBlock = '';

    if (callNotes) {
      contextBlock += `\nCall notes from the conversation:\n${callNotes}\n`;
    }

    if (prepQuestions.length > 0) {
      contextBlock += `\nQuestions the user prepared for the call:\n${prepQuestions.map((q) => `- ${q}`).join('\n')}\n`;
    }

    if (contactNotes) {
      contextBlock += `\nUser's notes about this contact:\n${contactNotes}\n`;
    }

    if (interactionNotes.length > 0) {
      contextBlock += `\nRecent interaction history:\n${interactionNotes.map((n) => `- ${n}`).join('\n')}\n`;
    }

    const prompt = `Write a short, professional thank-you email (4-6 sentences max) from ${userIntro} to ${contactDesc}.

The user recently had a phone call / coffee chat with this contact and wants to send a thank-you note.
${contextBlock || '\nNo specific call notes were recorded.\n'}
Guidelines:
- Keep it concise, warm, and genuine.
- Reference specific topics discussed if call notes or questions are available.
- Express gratitude for their time and insights.
- If relevant, mention a specific takeaway or something you learned.
- End by expressing interest in staying in touch.
- Start the email with "Hi ${contact.name.split(' ')[0]}," (first name only).
- End with "Best,\\n${userName}" as the sign-off.
- Do NOT use placeholder brackets like [Your Name] — use the actual information provided.

Return STRICT JSON: { "subject": "...", "body": "..." }
- subject: a short email subject line (e.g. "Thank you for your time")
- body: the full email text (use \\n for line breaks)
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

    return jsonResponse({
      subject: parsed?.subject || 'Thank you for your time',
      body: parsed?.body || '',
    });
  } catch (error: unknown) {
    console.error('Error in generate-thankyou-email:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, { status: 500 });
  }
});
