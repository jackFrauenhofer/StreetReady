import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Lock, Mail } from 'lucide-react';
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

type AuthFormData = z.infer<typeof authSchema>;

type Mode = 'signin' | 'signup';

export function AuthPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<Mode>('signin');
  const { signInWithPassword, signUpWithPassword } = useAuth();

  const form = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: AuthFormData) => {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-6">
            <span className="text-primary-foreground font-bold text-2xl">OR</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">OfferReady</h1>
          <p className="mt-2 text-muted-foreground">Your personal CRM for investment banking recruiting</p>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-2xl">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</CardTitle>
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
            </div>
            <CardDescription>
              {mode === 'signup'
                ? 'Use email and password. You will be signed in immediately.'
                : 'Sign in with your email and password.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
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
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
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
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Track conversations, follow-ups, and preparation for your recruiting journey.
        </p>
      </div>
    </div>
  );
}
