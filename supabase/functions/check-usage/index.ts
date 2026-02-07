import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Check whether a user can perform a gated action.
 *
 * POST body: { feature: 'mock_interview' | 'flashcard' | 'contact' }
 *
 * Returns:
 *   { allowed: boolean, usage: { mock_interviews, flashcards_viewed, contacts }, limits: {...}, plan: string }
 */

const FREE_LIMITS = {
  mock_interviews: 1,
  flashcards_viewed: 5,
  contacts: 3,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, { status: 405 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, { status: 401 });

    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const accessToken = tokenMatch?.[1];
    if (!accessToken) return jsonResponse({ error: 'Invalid Authorization header' }, { status: 401 });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userData?.user) return jsonResponse({ error: 'Invalid token' }, { status: 401 });

    const userId = userData.user.id;

    const { feature } = await req.json();
    if (!feature || !['mock_interview', 'flashcard', 'contact'].includes(feature)) {
      return jsonResponse({ error: 'Invalid feature. Must be mock_interview, flashcard, or contact' }, { status: 400 });
    }

    // Check subscription status
    const { data: sub } = await supabaseAdmin
      .from('user_subscriptions')
      .select('plan, status, trial_end, current_period_end')
      .eq('user_id', userId)
      .maybeSingle();

    const isPro = sub && ['active', 'trialing'].includes(sub.status) && sub.plan !== 'free';

    if (isPro) {
      return jsonResponse({
        allowed: true,
        plan: sub.plan,
        usage: null,
        limits: null,
      });
    }

    // Count usage for free users
    const [
      { count: mockInterviewCount },
      { count: flashcardsViewedCount },
      { count: contactsCount },
    ] = await Promise.all([
      supabaseAdmin
        .from('mock_interview_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabaseAdmin
        .from('user_flashcard_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabaseAdmin
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);

    const usage = {
      mock_interviews: mockInterviewCount ?? 0,
      flashcards_viewed: flashcardsViewedCount ?? 0,
      contacts: contactsCount ?? 0,
    };

    let allowed = true;
    if (feature === 'mock_interview' && usage.mock_interviews >= FREE_LIMITS.mock_interviews) {
      allowed = false;
    } else if (feature === 'flashcard' && usage.flashcards_viewed >= FREE_LIMITS.flashcards_viewed) {
      allowed = false;
    } else if (feature === 'contact' && usage.contacts >= FREE_LIMITS.contacts) {
      allowed = false;
    }

    return jsonResponse({
      allowed,
      plan: 'free',
      usage,
      limits: FREE_LIMITS,
    });
  } catch (error: unknown) {
    console.error('Error in check-usage:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, { status: 500 });
  }
});
