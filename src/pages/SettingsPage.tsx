import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/paywall/PaywallModal';
import { toast } from 'sonner';

const profileSchema = z.object({
  school: z.string().optional(),
  graduation_year: z.coerce.number().min(2020).max(2030).optional(),
  recruiting_goal: z.string().optional(),
  weekly_interactions_goal: z.coerce.number().min(1).max(50).optional(),
  weekly_flashcards_goal: z.coerce.number().min(1).max(100).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function SettingsPage() {
  const { user } = useAuth();
  const { profile, updateProfile, isLoading } = useProfile(user?.id);
  const { subscription, isLoadingSubscription, createCheckoutSession, createPortalSession, refreshSubscription } = useSubscription();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle checkout redirect
  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      toast.success('Subscription activated! Welcome to Pro.');
      refreshSubscription();
      searchParams.delete('checkout');
      setSearchParams(searchParams, { replace: true });
    } else if (searchParams.get('checkout') === 'canceled') {
      toast.info('Checkout canceled');
      searchParams.delete('checkout');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, refreshSubscription]);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: {
      school: profile?.school || '',
      graduation_year: profile?.graduation_year || undefined,
      recruiting_goal: profile?.recruiting_goal || 'Investment Banking',
      weekly_interactions_goal: profile?.weekly_interactions_goal || 10,
      weekly_flashcards_goal: profile?.weekly_flashcards_goal || 20,
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateProfile.mutateAsync({
        school: data.school || null,
        graduation_year: data.graduation_year || null,
        recruiting_goal: data.recruiting_goal || null,
        weekly_interactions_goal: data.weekly_interactions_goal || 10,
        weekly_flashcards_goal: data.weekly_flashcards_goal || 20,
      });
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your personal information for recruiting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="school"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>School</FormLabel>
                      <FormControl>
                        <Input placeholder="University name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="graduation_year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Graduation Year</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="recruiting_goal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recruiting Goal</FormLabel>
                    <FormControl>
                      <Input placeholder="Investment Banking" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Goals</CardTitle>
          <CardDescription>
            Set targets for your weekly activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="weekly_interactions_goal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weekly Interactions Goal</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={50} {...field} />
                    </FormControl>
                    <FormDescription>
                      Target networking interactions per week
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="weekly_flashcards_goal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weekly Flashcards Goal</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={100} {...field} />
                    </FormControl>
                    <FormDescription>
                      Target flashcards to study per week
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Your account information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between py-2">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{user?.email}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>
            Manage your plan and billing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Current Plan</p>
                <Badge variant={subscription.isPro ? 'default' : 'secondary'}>
                  {subscription.isPro
                    ? subscription.plan === 'pro_annual' ? 'Pro (Annual)' : 'Pro (Monthly)'
                    : 'Free'}
                </Badge>
                {subscription.status === 'trialing' && (
                  <Badge variant="outline" className="text-primary">
                    Trial
                  </Badge>
                )}
              </div>
              {subscription.isPro && subscription.currentPeriodEnd && (
                <p className="text-xs text-muted-foreground mt-1">
                  {subscription.cancelAtPeriodEnd
                    ? `Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                    : `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
                </p>
              )}
              {subscription.status === 'trialing' && subscription.trialEnd && (
                <p className="text-xs text-muted-foreground mt-1">
                  Trial ends {new Date(subscription.trialEnd).toLocaleDateString()}
                </p>
              )}
              {!subscription.isPro && (
                <p className="text-xs text-muted-foreground mt-1">
                  Limited to 1 mock interview, 5 flashcards, 3 connections
                </p>
              )}
            </div>
            {subscription.isPro ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  createPortalSession.mutate(undefined, {
                    onSuccess: (data) => { window.location.href = data.url; },
                    onError: () => toast.error('Failed to open billing portal'),
                  });
                }}
                disabled={createPortalSession.isPending}
              >
                {createPortalSession.isPending ? 'Loading...' : 'Manage Subscription'}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setPaywallOpen(true)}
              >
                Upgrade to Pro
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            Connect external services to enhance your workflow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Google Calendar</p>
              <p className="text-xs text-muted-foreground">
                Sync your scheduled calls with Google Calendar
              </p>
            </div>
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </div>
        </CardContent>
      </Card>

      <PaywallModal
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
      />
    </div>
  );
}
