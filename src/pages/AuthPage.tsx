import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, ArrowLeft, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password is too long'),
});

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const resetSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password is too long'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type AuthFormData = z.infer<typeof authSchema>;
type ForgotFormData = z.infer<typeof forgotSchema>;
type ResetFormData = z.infer<typeof resetSchema>;

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export function AuthPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const initialMode = (searchParams.get('mode') as Mode) || 'signin';
  const [mode, setMode] = useState<Mode>(
    ['signin', 'signup', 'forgot', 'reset'].includes(initialMode) ? initialMode : 'signin',
  );
  const { signInWithPassword, signUpWithPassword, signInWithGoogle, resetPasswordForEmail, updatePassword } = useAuth();

  // Detect recovery session from Supabase (password reset link clicked)
  useEffect(() => {
    if (searchParams.get('mode') === 'reset') {
      setMode('reset');
    }
  }, [searchParams]);

  const authForm = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: '', password: '' },
  });

  const forgotForm = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const resetForm = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onAuthSubmit = async (data: AuthFormData) => {
    setIsSubmitting(true);
    try {
      const { error } =
        mode === 'signup'
          ? await signUpWithPassword(data.email, data.password)
          : await signInWithPassword(data.email, data.password);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(mode === 'signup' ? 'Account created — you are now signed in.' : 'Signed in successfully.');
    } catch {
      toast.error('Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onForgotSubmit = async (data: ForgotFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await resetPasswordForEmail(data.email);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Check your email for a password reset link.');
    } catch {
      toast.error('Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetSubmit = async (data: ResetFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await updatePassword(data.password);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Password updated successfully. You are now signed in.');
    } catch {
      toast.error('Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error(error.message);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'signup': return 'Create your account';
      case 'forgot': return 'Reset your password';
      case 'reset': return 'Set new password';
      default: return 'Welcome back';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'signup': return 'Use email and password. You will be signed in immediately.';
      case 'forgot': return "Enter your email and we'll send you a reset link.";
      case 'reset': return 'Choose a new password for your account.';
      default: return 'Sign in with your email and password.';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto w-20 h-20 mb-4">
            <img src="/favicon.svg" alt="OfferReady" className="w-full h-full" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">OfferReady</h2>
          <p className="mt-1 text-muted-foreground text-sm">Your personal CRM for investment banking recruiting</p>
        </div>

        <Card className="border-border/60">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-2xl">{getTitle()}</CardTitle>
              {(mode === 'signin' || mode === 'signup') && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={mode === 'signin' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMode('signin')}
                    disabled={isSubmitting}
                  >
                    Sign in
                  </Button>
                  <Button
                    type="button"
                    variant={mode === 'signup' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMode('signup')}
                    disabled={isSubmitting}
                  >
                    Sign up
                  </Button>
                </div>
              )}
            </div>
            <CardDescription>{getDescription()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google Sign-In — only on signin/signup */}
            {(mode === 'signin' || mode === 'signup') && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting}
                >
                  <GoogleIcon className="h-5 w-5 mr-2" />
                  Continue with Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
              </>
            )}

            {/* Sign in / Sign up form */}
            {(mode === 'signin' || mode === 'signup') && (
              <Form {...authForm}>
                <form onSubmit={authForm.handleSubmit(onAuthSubmit)} className="space-y-4">
                  <FormField
                    control={authForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input type="email" placeholder="you@university.edu" className="pl-9" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={authForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Password</FormLabel>
                          {mode === 'signin' && (
                            <button
                              type="button"
                              className="text-xs text-primary hover:underline"
                              onClick={() => setMode('forgot')}
                            >
                              Forgot password?
                            </button>
                          )}
                        </div>
                        <FormControl>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input type="password" placeholder="••••••••" className="pl-9" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      mode === 'signup' ? 'Creating...' : 'Signing in...'
                    ) : (
                      <>
                        {mode === 'signup' ? 'Create account' : 'Sign in'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            )}

            {/* Forgot password form */}
            {mode === 'forgot' && (
              <Form {...forgotForm}>
                <form onSubmit={forgotForm.handleSubmit(onForgotSubmit)} className="space-y-4">
                  <FormField
                    control={forgotForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input type="email" placeholder="you@university.edu" className="pl-9" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Sending...' : 'Send reset link'}
                  </Button>

                  <button
                    type="button"
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mx-auto"
                    onClick={() => setMode('signin')}
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back to sign in
                  </button>
                </form>
              </Form>
            )}

            {/* Reset password form */}
            {mode === 'reset' && (
              <Form {...resetForm}>
                <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
                  <FormField
                    control={resetForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input type="password" placeholder="••••••••" className="pl-9" autoComplete="new-password" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={resetForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input type="password" placeholder="••••••••" className="pl-9" autoComplete="new-password" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Updating...' : 'Update password'}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Track conversations, follow-ups, and preparation for your recruiting journey.
        </p>
      </div>
    </div>
  );
}
