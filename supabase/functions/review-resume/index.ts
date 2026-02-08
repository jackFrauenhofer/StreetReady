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

    const { resumeId } = await req.json();
    if (!resumeId || typeof resumeId !== 'string') {
      return jsonResponse({ error: 'Missing resumeId' }, { status: 400 });
    }

    // Fetch resume record
    const { data: resume, error: resumeErr } = await supabaseAdmin
      .from('user_resumes')
      .select('id, user_id, file_path')
      .eq('id', resumeId)
      .single();

    if (resumeErr || !resume) {
      return jsonResponse({ error: 'Resume not found' }, { status: 404 });
    }

    if (resume.user_id !== userId) {
      return jsonResponse({ error: 'Forbidden' }, { status: 403 });
    }

    // Download PDF from storage
    const { data: pdfBlob, error: downloadErr } = await supabaseAdmin
      .storage
      .from('resumes')
      .download(resume.file_path);

    if (downloadErr || !pdfBlob) {
      console.error('Failed to download resume:', downloadErr);
      return jsonResponse({ error: 'Failed to download resume file' }, { status: 500 });
    }

    // Upload the PDF to OpenAI Files API
    const uploadForm = new FormData();
    uploadForm.append('purpose', 'assistants');
    uploadForm.append('file', pdfBlob, 'resume.pdf');

    const fileUploadResp = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: uploadForm,
    });

    if (!fileUploadResp.ok) {
      const errText = await fileUploadResp.text();
      console.error('OpenAI file upload error:', errText);
      return jsonResponse({ error: 'Failed to upload PDF to OpenAI' }, { status: 500 });
    }

    const fileData = await fileUploadResp.json();
    const openaiFileId = fileData.id;

    // Send to GPT-4o for resume review
    const systemPrompt = `You are an expert investment banking recruiting resume reviewer. You review resumes specifically for candidates targeting investment banking analyst positions at bulge bracket banks and elite boutiques.

Review the attached PDF resume and produce a detailed, actionable review.

Return STRICT JSON with this shape:
{
  "overall_score": <number 0-100>,
  "section_scores": {
    "formatting": <number 1-10>,
    "experience": <number 1-10>,
    "education": <number 1-10>,
    "skills": <number 1-10>,
    "impact_quantification": <number 1-10>
  },
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "improvements": [
    { "section": "Experience", "suggestion": "..." },
    { "section": "Formatting", "suggestion": "..." },
    ...
  ],
  "summary": "A 2-3 sentence overall assessment of the resume."
}

Guidelines:
- Score formatting on: consistency, readability, proper use of whitespace, single page, professional font.
- Score experience on: relevance to IB (finance, consulting, accounting internships), quality of bullet points, action verbs.
- Score education on: school prestige/target status, GPA, relevant coursework, honors.
- Score skills on: relevant technical skills (Excel, PowerPoint, financial modeling, Bloomberg, Capital IQ), languages.
- Score impact_quantification on: use of numbers, dollar amounts, percentages to quantify achievements.
- Strengths should highlight what the candidate does well (3-5 items).
- Weaknesses should be honest but constructive (3-5 items).
- Improvements should be specific and actionable (4-6 items), each tied to a section.
- The overall_score should reflect how competitive this resume would be for IB recruiting.
- Return valid JSON only, no markdown fencing.`;

    const chatResp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.3,
        input: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'input_file',
                file_id: openaiFileId,
              },
              {
                type: 'input_text',
                text: 'Please review this resume for investment banking recruiting and provide a detailed assessment.',
              },
            ],
          },
        ],
        text: {
          format: { type: 'json_object' },
        },
      }),
    });

    // Clean up the uploaded file (non-blocking)
    fetch(`https://api.openai.com/v1/files/${openaiFileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${openaiApiKey}` },
    }).catch(() => {});

    if (!chatResp.ok) {
      const errText = await chatResp.text();
      console.error('GPT-4o error:', errText);
      return jsonResponse({ error: 'Resume review failed' }, { status: 500 });
    }

    const chatJson = await chatResp.json();
    // Responses API returns output array with message items containing text content
    const outputMessage = chatJson?.output?.find((o: any) => o.type === 'message');
    const textContent = outputMessage?.content?.find((c: any) => c.type === 'output_text');
    const content = textContent?.text ?? chatJson?.choices?.[0]?.message?.content ?? null;

    if (!content) {
      console.error('No content in GPT-4o response:', JSON.stringify(chatJson));
      return jsonResponse({ error: 'No content in GPT response' }, { status: 500 });
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse GPT-4o JSON:', content);
      return jsonResponse({ error: 'Resume review response invalid' }, { status: 500 });
    }

    // Stamp the review time
    parsed.reviewed_at = new Date().toISOString();

    // Save review results to the resume record
    const { error: updateErr } = await supabaseAdmin
      .from('user_resumes')
      .update({
        review_json: parsed,
      })
      .eq('id', resumeId);

    if (updateErr) {
      console.error('Failed to update resume record:', updateErr);
      return jsonResponse({ error: 'Failed to save review' }, { status: 500 });
    }

    return jsonResponse({ success: true, review: parsed });
  } catch (error: unknown) {
    console.error('Error in review-resume:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, { status: 500 });
  }
});
