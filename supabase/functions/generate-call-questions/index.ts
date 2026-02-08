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

    // Fetch contact record
    const { data: contact, error: contactErr } = await supabaseAdmin
      .from('contacts')
      .select('id, user_id, name, firm, group_name, position, connection_type, notes_summary')
      .eq('id', contactId)
      .single();

    if (contactErr || !contact) {
      return jsonResponse({ error: 'Contact not found' }, { status: 404 });
    }

    if (contact.user_id !== userId) {
      return jsonResponse({ error: 'Forbidden' }, { status: 403 });
    }

    // Build context string
    const parts: string[] = [];
    parts.push(`Name: ${contact.name}`);
    if (contact.firm) parts.push(`Firm: ${contact.firm}`);
    if (contact.group_name) parts.push(`Group: ${contact.group_name}`);
    if (contact.position) parts.push(`Position: ${contact.position}`);
    if (contact.connection_type) parts.push(`Connection type: ${contact.connection_type}`);
    if (contact.notes_summary) parts.push(`Notes: ${contact.notes_summary}`);

    const contactContext = parts.join('\n');

    const prompt = `You are a networking coach for an aspiring investment banking analyst. Generate 5-7 thoughtful, personalized questions for an upcoming networking call with the following contact:

${contactContext}

Guidelines:
- Questions should help build rapport and demonstrate genuine interest in the person and their work.
- Include questions about their career path, their group/team, recent deals or trends at their firm, and advice for breaking into IB.
- Avoid generic questions — tailor them to the specific firm, group, and position.
- Keep questions concise (1-2 sentences each).
- Return STRICT JSON with this shape: { "questions": ["question 1", "question 2", ...] }
- Return valid JSON only, no markdown fencing.`;

    const chatResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.5,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!chatResp.ok) {
      const errText = await chatResp.text();
      console.error('OpenAI error:', errText);
      return jsonResponse({ error: 'Failed to generate questions' }, { status: 500 });
    }

    const chatJson = await chatResp.json();
    const content = chatJson?.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in response:', JSON.stringify(chatJson));
      return jsonResponse({ error: 'No content in response' }, { status: 500 });
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse JSON:', content);
      return jsonResponse({ error: 'Invalid response format' }, { status: 500 });
    }

    const questions: string[] = Array.isArray(parsed?.questions) ? parsed.questions : [];

    return jsonResponse({ questions });
  } catch (error: unknown) {
    console.error('Error in generate-call-questions:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, { status: 500 });
  }
});
