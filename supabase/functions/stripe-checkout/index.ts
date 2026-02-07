import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Create a Stripe Checkout Session for subscription.
 *
 * POST body: { priceType: 'monthly' | 'annual', returnUrl: string }
 *
 * Returns: { url: string } — the Stripe Checkout URL to redirect to.
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

async function stripeRequest(path: string, body: Record<string, string>, stripeKey: string) {
  const resp = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
  });
  const data = await resp.json();
  if (!resp.ok) {
    console.error('Stripe error:', JSON.stringify(data));
    throw new Error(data?.error?.message || 'Stripe API error');
  }
  return data;
}

async function stripeGet(path: string, params: Record<string, string>, stripeKey: string) {
  const qs = new URLSearchParams(params).toString();
  const resp = await fetch(`https://api.stripe.com/v1${path}?${qs}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const data = await resp.json();
  if (!resp.ok) {
    console.error('Stripe error:', JSON.stringify(data));
    throw new Error(data?.error?.message || 'Stripe API error');
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, { status: 405 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const priceMonthly = Deno.env.get('STRIPE_PRICE_MONTHLY');
    const priceAnnual = Deno.env.get('STRIPE_PRICE_ANNUAL');

    if (!stripeKey) return jsonResponse({ error: 'Stripe not configured' }, { status: 500 });
    if (!priceMonthly || !priceAnnual) return jsonResponse({ error: 'Stripe prices not configured' }, { status: 500 });

    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, { status: 401 });

    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const accessToken = tokenMatch?.[1];
    if (!accessToken) return jsonResponse({ error: 'Invalid Authorization header' }, { status: 401 });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userData?.user) return jsonResponse({ error: 'Invalid token' }, { status: 401 });

    const userId = userData.user.id;
    const userEmail = userData.user.email;

    const { priceType, returnUrl } = await req.json();
    if (!priceType || !['monthly', 'annual'].includes(priceType)) {
      return jsonResponse({ error: 'Invalid priceType. Must be monthly or annual' }, { status: 400 });
    }
    if (!returnUrl) return jsonResponse({ error: 'Missing returnUrl' }, { status: 400 });

    const priceId = priceType === 'monthly' ? priceMonthly : priceAnnual;

    // Check if user already has a Stripe customer
    const { data: existingSub } = await supabaseAdmin
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    let customerId: string;

    if (existingSub?.stripe_customer_id) {
      customerId = existingSub.stripe_customer_id;
    } else {
      // Create Stripe customer
      const customerParams: Record<string, string> = {
        'metadata[supabase_user_id]': userId,
      };
      if (userEmail) customerParams.email = userEmail;

      const customer = await stripeRequest('/customers', customerParams, stripeKey);
      customerId = customer.id;

      // Store customer ID in DB
      await supabaseAdmin
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          plan: 'free',
          status: 'active',
        }, { onConflict: 'user_id' });
    }

    // Create Checkout Session with 7-day trial
    const session = await stripeRequest('/checkout/sessions', {
      customer: customerId,
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'subscription_data[trial_period_days]': '7',
      success_url: `${returnUrl}?checkout=success`,
      cancel_url: `${returnUrl}?checkout=canceled`,
      'allow_promotion_codes': 'true',
    }, stripeKey);

    return jsonResponse({ url: session.url });
  } catch (error: unknown) {
    console.error('Error in stripe-checkout:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, { status: 500 });
  }
});
