import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Stripe Webhook handler.
 *
 * Handles:
 *   - checkout.session.completed
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *
 * Verifies webhook signature using STRIPE_WEBHOOK_SECRET.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

// Minimal Stripe signature verification (HMAC-SHA256)
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = sigHeader.split(',').reduce((acc: Record<string, string>, part) => {
    const [key, val] = part.split('=');
    if (key && val) acc[key.trim()] = val.trim();
    return acc;
  }, {});

  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature) return false;

  // Reject if timestamp is older than 5 minutes
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (age > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return expected === signature;
}

function planFromPriceId(priceId: string, priceMonthly: string, priceAnnual: string): string {
  if (priceId === priceMonthly) return 'pro_monthly';
  if (priceId === priceAnnual) return 'pro_annual';
  return 'pro_monthly'; // fallback
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, { status: 405 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const priceMonthly = Deno.env.get('STRIPE_PRICE_MONTHLY') ?? '';
    const priceAnnual = Deno.env.get('STRIPE_PRICE_ANNUAL') ?? '';

    const rawBody = await req.text();

    // Verify signature if webhook secret is set
    if (stripeWebhookSecret) {
      const sigHeader = req.headers.get('stripe-signature') ?? '';
      const valid = await verifyStripeSignature(rawBody, sigHeader, stripeWebhookSecret);
      if (!valid) {
        console.error('Invalid Stripe signature');
        return jsonResponse({ error: 'Invalid signature' }, { status: 400 });
      }
    }

    const event = JSON.parse(rawBody);
    const eventType = event.type;

    console.log('Stripe webhook event:', eventType);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (eventType === 'checkout.session.completed') {
      const session = event.data.object;
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      if (!customerId || !subscriptionId) {
        console.log('No customer or subscription in checkout session');
        return jsonResponse({ received: true });
      }

      // Fetch subscription details from Stripe
      const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
        headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` },
      });
      const sub = await subResp.json();

      const priceId = sub.items?.data?.[0]?.price?.id ?? '';
      const plan = planFromPriceId(priceId, priceMonthly, priceAnnual);

      await supabaseAdmin
        .from('user_subscriptions')
        .update({
          stripe_subscription_id: subscriptionId,
          plan,
          status: sub.status,
          current_period_start: sub.current_period_start
            ? new Date(sub.current_period_start * 1000).toISOString()
            : null,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
          trial_end: sub.trial_end
            ? new Date(sub.trial_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', customerId);

      console.log(`Checkout completed: customer=${customerId}, plan=${plan}, status=${sub.status}`);
    }

    if (eventType === 'customer.subscription.updated') {
      const sub = event.data.object;
      const customerId = sub.customer;
      const priceId = sub.items?.data?.[0]?.price?.id ?? '';
      const plan = planFromPriceId(priceId, priceMonthly, priceAnnual);

      await supabaseAdmin
        .from('user_subscriptions')
        .update({
          plan,
          status: sub.status,
          current_period_start: sub.current_period_start
            ? new Date(sub.current_period_start * 1000).toISOString()
            : null,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
          trial_end: sub.trial_end
            ? new Date(sub.trial_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', customerId);

      console.log(`Subscription updated: customer=${customerId}, plan=${plan}, status=${sub.status}`);
    }

    if (eventType === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const customerId = sub.customer;

      await supabaseAdmin
        .from('user_subscriptions')
        .update({
          plan: 'free',
          status: 'canceled',
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', customerId);

      console.log(`Subscription deleted: customer=${customerId}`);
    }

    return jsonResponse({ received: true });
  } catch (error: unknown) {
    console.error('Error in stripe-webhook:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, { status: 500 });
  }
});
