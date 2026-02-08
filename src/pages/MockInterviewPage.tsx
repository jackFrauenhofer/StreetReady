import { Mic } from 'lucide-react';
import { SessionSetupForm } from '@/components/mock-interview/SessionSetupForm';

export function MockInterviewPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Mic className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Mock Interview</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Practice timed interview questions with AI-style feedback. Configure your session 
          below and get personalized scoring on your responses.
        </p>
      </div>

      {/* Setup Form */}
      <div data-tour="mock-interview-setup" className="max-w-2xl">
        <SessionSetupForm />
      </div>
    </div>
  );
}
