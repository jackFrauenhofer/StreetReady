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

    // First, upload the PDF to OpenAI Files API for use with chat
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

    // Send to GPT-4o for extraction and parsing using the Responses API
    const systemPrompt = `You are a resume parser. Extract all the text content from the attached PDF resume and produce a structured JSON summary.

Return STRICT JSON with this shape:
{
  "raw_text": "<the full extracted text of the resume>",
  "summary": {
    "name": "...",
    "school": "...",
    "graduation_year": "...",
    "major": "...",
    "gpa": "...",
    "work_experience": [
      {
        "company": "...",
        "role": "...",
        "dates": "...",
        "highlights": ["bullet point 1", "bullet point 2"]
      }
    ],
    "leadership_activities": [
      {
        "organization": "...",
        "role": "...",
        "highlights": ["..."]
      }
    ],
    "skills": ["..."],
    "certifications": ["..."],
    "interests": ["..."]
  }
}

Guidelines:
- Extract ALL text from the resume accurately.
- For work_experience, preserve the original bullet points as highlights.
- If a field is not present in the resume, use null.
- Return valid JSON only, no markdown fencing.`;

    const chatResp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.1,
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
                text: 'Please extract and parse this resume.',
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
      return jsonResponse({ error: 'Resume processing failed' }, { status: 500 });
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
      return jsonResponse({ error: 'Resume parsing response invalid' }, { status: 500 });
    }

    const rawText = parsed?.raw_text ?? '';
    const summary = parsed?.summary ?? parsed;

    // Update the resume record with extracted text and parsed JSON
    const { error: updateErr } = await supabaseAdmin
      .from('user_resumes')
      .update({
        extracted_text: typeof rawText === 'string' ? rawText : JSON.stringify(rawText),
        parsed_resume_json: summary,
      })
      .eq('id', resumeId);

    if (updateErr) {
      console.error('Failed to update resume record:', updateErr);
      return jsonResponse({ error: 'Failed to save parsed resume' }, { status: 500 });
    }

    return jsonResponse({ success: true, summary });
  } catch (error: unknown) {
    console.error('Error in process-resume:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, { status: 500 });
  }
});
