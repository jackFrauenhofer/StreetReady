import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { useSubscription, FREE_LIMITS, type UsageData } from '@/hooks/useSubscription';
import { toast } from 'sonner';

interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
  usage?: UsageData | null;
}

export function PaywallModal({ open, onOpenChange, feature, usage }: PaywallModalProps) {
  const { createCheckoutSession } = useSubscription();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');

  const handleCheckout = () => {
    createCheckoutSession.mutate(
      { priceType: billingPeriod },
      {
        onSuccess: (data) => {
          window.location.href = data.url;
        },
        onError: () => {
          toast.error('Failed to start checkout. Please try again.');
        },
      },
    );
  };

  const featureLabels: Record<string, string> = {
    mock_interview: 'mock interviews',
    flashcard: 'flashcards',
    contact: 'CRM connections',
  };

  const featureLabel = feature ? featureLabels[feature] ?? feature : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Upgrade to Pro</DialogTitle>
          <DialogDescription>
            {feature
              ? `You've reached the free limit for ${featureLabel}. Upgrade to unlock unlimited access.`
              : 'Unlock unlimited access to all features.'}
          </DialogDescription>
        </DialogHeader>

        {usage && (
          <div className="grid grid-cols-3 gap-3 py-2">
            <UsagePill
              label="Interviews"
              used={usage.mock_interviews}
              limit={FREE_LIMITS.mock_interviews}
              highlight={feature === 'mock_interview'}
            />
            <UsagePill
              label="Flashcards"
              used={usage.flashcards_viewed}
              limit={FREE_LIMITS.flashcards_viewed}
              highlight={feature === 'flashcard'}
            />
            <UsagePill
              label="Connections"
              used={usage.contacts}
              limit={FREE_LIMITS.contacts}
              highlight={feature === 'contact'}
            />
          </div>
        )}

        <div className="space-y-4 pt-2">
          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-2 p-1 bg-muted rounded-lg">
            <button
              className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'monthly'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setBillingPeriod('monthly')}
            >
              Monthly
            </button>
            <button
              className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'annual'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setBillingPeriod('annual')}
            >
              Annual
              <Badge variant="secondary" className="ml-1.5 text-xs">
                Save 33%
              </Badge>
            </button>
          </div>

          {/* Price */}
          <div className="text-center py-2">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold text-foreground">
                ${billingPeriod === 'monthly' ? '15' : '10'}
              </span>
              <span className="text-muted-foreground">/month</span>
            </div>
            {billingPeriod === 'annual' && (
              <p className="text-sm text-muted-foreground mt-1">
                $120/year billed annually
              </p>
            )}
            <p className="text-sm text-primary font-medium mt-2">
              7-day free trial included
            </p>
          </div>

          {/* Features */}
          <ul className="space-y-2">
            {[
              'Unlimited mock interviews with AI scoring',
              'Unlimited flashcard studying',
              'Unlimited CRM connections & pipeline',
              'Google Calendar integration',
              'Priority support',
            ].map((feat) => (
              <li key={feat} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>

          <Button
            className="w-full"
            size="lg"
            onClick={handleCheckout}
            disabled={createCheckoutSession.isPending}
          >
            {createCheckoutSession.isPending
              ? 'Redirecting to checkout...'
              : 'Start Free Trial'}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Cancel anytime during your trial. No charge until trial ends.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UsagePill({
  label,
  used,
  limit,
  highlight,
}: {
  label: string;
  used: number;
  limit: number;
  highlight: boolean;
}) {
  const atLimit = used >= limit;
  return (
    <div
      className={`text-center p-2 rounded-lg border ${
        highlight && atLimit
          ? 'border-destructive bg-destructive/5'
          : 'border-border'
      }`}
    >
      <p className={`text-lg font-bold ${atLimit ? 'text-destructive' : 'text-foreground'}`}>
        {used}/{limit}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
