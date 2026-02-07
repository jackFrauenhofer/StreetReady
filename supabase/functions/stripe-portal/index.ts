import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Create a Stripe Customer Portal session for managing subscription.
 *
 * POST body: { returnUrl: string }
 *
 * Returns: { url: string }
 */

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
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeKey) return jsonResponse({ error: 'Stripe not configured' }, { status: 500 });

    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, { status: 401 });

    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const accessToken = tokenMatch?.[1];
    if (!accessToken) return jsonResponse({ error: 'Invalid Authorization header' }, { status: 401 });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userData?.user) return jsonResponse({ error: 'Invalid token' }, { status: 401 });

    const userId = userData.user.id;

    const { returnUrl } = await req.json();
    if (!returnUrl) return jsonResponse({ error: 'Missing returnUrl' }, { status: 400 });

    // Get customer ID
    const { data: sub } = await supabaseAdmin
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return jsonResponse({ error: 'No subscription found' }, { status: 400 });
    }

    // Create portal session
    const resp = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: sub.stripe_customer_id,
        return_url: returnUrl,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('Stripe portal error:', JSON.stringify(data));
      return jsonResponse({ error: data?.error?.message || 'Portal creation failed' }, { status: 500 });
    }

    return jsonResponse({ url: data.url });
  } catch (error: unknown) {
    console.error('Error in stripe-portal:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, { status: 500 });
  }
});
