import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ScoreBreakdown = {
  structure: number;
  clarity: number;
  specificity: number;
  confidence: number;
  conciseness: number;
};

type ScoreResult = {
  transcript: string;
  score_overall: number;
  score_breakdown: ScoreBreakdown;
  feedback: string;
  suggested_answer: string;
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

function clampScore(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
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

    const authHeader =
      req.headers.get('authorization') ??
      req.headers.get('Authorization');

    if (!authHeader) {
      return jsonResponse(
        { error: 'Missing Authorization header (must call from logged-in client)' },
        { status: 401 }
      );
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

    const authedUserId = userData.user.id;

    const { answerId } = await req.json();
    if (!answerId || typeof answerId !== 'string') {
      return jsonResponse({ error: 'Missing answerId' }, { status: 400 });
    }

    const { data: answer, error: answerErr } = await supabaseAdmin
      .from('mock_interview_answers')
      .select('id, session_id, question_id, recording_url')
      .eq('id', answerId)
      .single();

    if (answerErr || !answer) {
      return jsonResponse({ error: 'Answer not found' }, { status: 404 });
    }

    const { data: session, error: sessionErr } = await supabaseAdmin
      .from('mock_interview_sessions')
      .select('user_id')
      .eq('id', answer.session_id)
      .single();

    if (sessionErr || !session) {
      return jsonResponse({ error: 'Session not found' }, { status: 404 });
    }

    if (session.user_id !== authedUserId) {
      return jsonResponse({ error: 'Forbidden' }, { status: 403 });
    }

    if (!answer.recording_url) {
      return jsonResponse({ error: 'Answer has no recording_url' }, { status: 400 });
    }

    const { data: question, error: questionErr } = await supabaseAdmin
      .from('mock_interview_questions')
      .select('question_text')
      .eq('id', answer.question_id)
      .single();

    if (questionErr || !question) {
      return jsonResponse({ error: 'Question not found' }, { status: 404 });
    }

    const { data: audioBlob, error: downloadErr } = await supabaseAdmin
      .storage
      .from('mock-interview-recordings')
      .download(answer.recording_url);

    if (downloadErr || !audioBlob) {
      return jsonResponse({ error: 'Failed to download recording' }, { status: 500 });
    }

    // Whisper transcription
    const transcriptionForm = new FormData();
    transcriptionForm.append('model', 'whisper-1');
    transcriptionForm.append('file', audioBlob, 'answer.webm');

    const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: transcriptionForm,
    });

    if (!whisperResp.ok) {
      const errText = await whisperResp.text();
      console.error('Whisper error:', errText);
      return jsonResponse({ error: 'Transcription failed' }, { status: 500 });
    }

    const whisperJson = await whisperResp.json();
    const transcript = (whisperJson?.text ?? '').toString().trim();

    // LLM scoring
    const scoringPrompt = {
      role: 'user',
      content: `You are an interview coach scoring a candidate's answer.\n\nQuestion:\n${question.question_text}\n\nCandidate answer (transcript):\n${transcript}\n\nReturn STRICT JSON with the following shape:\n{\n  "score_breakdown": {"structure": 0-10, "clarity": 0-10, "specificity": 0-10, "confidence": 0-10, "conciseness": 0-10},\n  "feedback": "...",\n  "suggested_answer": "..."\n}\n\nGuidelines:\n- Be constructive and specific.\n- Suggested answer should be concise and high quality.\n- Use integers 0-10.`,
    };

    const chatResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        messages: [scoringPrompt],
        response_format: { type: 'json_object' },
      }),
    });

    if (!chatResp.ok) {
      const errText = await chatResp.text();
      console.error('Chat error:', errText);
      return jsonResponse({ error: 'Scoring failed' }, { status: 500 });
    }

    const chatJson = await chatResp.json();
    const content = chatJson?.choices?.[0]?.message?.content;
    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse LLM JSON:', content);
      return jsonResponse({ error: 'Scoring response invalid' }, { status: 500 });
    }

    const breakdownRaw = parsed?.score_breakdown ?? {};
    const breakdown: ScoreBreakdown = {
      structure: clampScore(breakdownRaw.structure),
      clarity: clampScore(breakdownRaw.clarity),
      specificity: clampScore(breakdownRaw.specificity),
      confidence: clampScore(breakdownRaw.confidence),
      conciseness: clampScore(breakdownRaw.conciseness),
    };

    const overall = Math.round(
      (breakdown.structure + breakdown.clarity + breakdown.specificity + breakdown.confidence + breakdown.conciseness) /
        5 *
        10,
    );

    const result: ScoreResult = {
      transcript,
      score_overall: overall,
      score_breakdown: breakdown,
      feedback: (parsed?.feedback ?? '').toString(),
      suggested_answer: (parsed?.suggested_answer ?? '').toString(),
    };

    const { error: updateErr } = await supabaseAdmin
      .from('mock_interview_answers')
      .update({
        transcript: result.transcript,
        score_overall: result.score_overall,
        score_breakdown_json: result.score_breakdown,
        feedback: result.feedback,
        suggested_answer: result.suggested_answer,
      })
      .eq('id', answerId);

    if (updateErr) {
      console.error('Failed to update answer:', updateErr);
      return jsonResponse({ error: 'Failed to save results' }, { status: 500 });
    }

    return jsonResponse(result);
  } catch (error: unknown) {
    console.error('Error in score-mock-interview:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, { status: 500 });
  }
});
