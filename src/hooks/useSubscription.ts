import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const FREE_LIMITS = {
  mock_interviews: 1,
  flashcards_viewed: 5,
  contacts: 3,
} as const;

export type GatedFeature = 'mock_interview' | 'flashcard' | 'contact';

export interface UsageData {
  mock_interviews: number;
  flashcards_viewed: number;
  contacts: number;
}

export interface CheckUsageResult {
  allowed: boolean;
  plan: string;
  usage: UsageData | null;
  limits: typeof FREE_LIMITS | null;
}

export interface SubscriptionInfo {
  plan: string;
  status: string;
  isPro: boolean;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch subscription info from DB (via RLS)
  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async (): Promise<SubscriptionInfo> => {
      if (!user) return { plan: 'free', status: 'active', isPro: false, trialEnd: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };

      const { data, error } = await (supabase as any)
        .from('user_subscriptions')
        .select('plan, status, trial_end, current_period_end, cancel_at_period_end')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) {
        return { plan: 'free', status: 'active', isPro: false, trialEnd: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };
      }

      const isPro = ['active', 'trialing'].includes(data.status) && data.plan !== 'free';

      return {
        plan: data.plan,
        status: data.status,
        isPro,
        trialEnd: data.trial_end,
        currentPeriodEnd: data.current_period_end,
        cancelAtPeriodEnd: data.cancel_at_period_end,
      };
    },
    enabled: !!user,
  });

  // Check usage for a specific feature (calls the edge function)
  const checkUsage = async (feature: GatedFeature): Promise<CheckUsageResult> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return { allowed: false, plan: 'free', usage: null, limits: FREE_LIMITS };

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/check-usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ feature }),
    });

    if (!resp.ok) {
      console.error('check-usage failed:', resp.status);
      // Fail open — allow the action if the check fails
      return { allowed: true, plan: 'free', usage: null, limits: null };
    }

    return resp.json();
  };

  // Create a Stripe Checkout Session
  const createCheckoutSession = useMutation({
    mutationFn: async ({ priceType }: { priceType: 'monthly' | 'annual' }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Not logged in');

      const returnUrl = window.location.origin + '/settings';

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ priceType, returnUrl }),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        console.error('stripe-checkout failed:', resp.status, errBody);
        throw new Error(`Checkout failed (${resp.status})`);
      }

      return resp.json() as Promise<{ url: string }>;
    },
  });

  // Manage subscription (redirect to Stripe Customer Portal)
  const createPortalSession = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Not logged in');

      const returnUrl = window.location.origin + '/settings';

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/stripe-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ returnUrl }),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        console.error('stripe-portal failed:', resp.status, errBody);
        throw new Error(`Portal failed (${resp.status})`);
      }

      return resp.json() as Promise<{ url: string }>;
    },
  });

  const refreshSubscription = () => {
    queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] });
  };

  return {
    subscription: subscription ?? { plan: 'free', status: 'active', isPro: false, trialEnd: null, currentPeriodEnd: null, cancelAtPeriodEnd: false },
    isLoadingSubscription,
    checkUsage,
    createCheckoutSession,
    createPortalSession,
    refreshSubscription,
  };
}
