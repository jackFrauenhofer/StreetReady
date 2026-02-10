import { useState } from 'react';
import { Sparkles, Loader2, Copy, ExternalLink, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface MessagedPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: { id: string; name: string; email: string | null } | null;
  onComplete: () => void;
}

export function MessagedPromptModal({
  open,
  onOpenChange,
  contact,
  onComplete,
}: MessagedPromptModalProps) {
  const [generating, setGenerating] = useState(false);
  const [email, setEmail] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleAlreadyMessaged = () => {
    onComplete();
    handleClose();
  };

  const handleGenerateEmail = async () => {
    if (!contact) return;
    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(`${supabaseUrl}/functions/v1/generate-outreach-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          contactId: contact.id,
          clientYear: new Date().getFullYear(),
          clientMonth: new Date().getMonth() + 1,
          clientDay: new Date().getDate(),
        }),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`Failed (${resp.status}): ${errBody}`);
      }

      const { subject, body } = await resp.json();
      setEmail({ subject: subject || 'Networking Introduction', body: body || '' });
      onComplete();
    } catch (error) {
      console.error('Generate email error:', error);
      toast.error('Failed to generate email');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!email) return;
    const fullText = `Subject: ${email.subject}\n\n${email.body}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success('Email copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInMail = () => {
    if (!email || !contact) return;
    const mailto = `mailto:${contact.email || ''}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
    window.open(mailto, '_blank');
  };

  const handleDone = () => {
    handleClose();
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after animation
    setTimeout(() => {
      setEmail(null);
      setGenerating(false);
      setCopied(false);
    }, 200);
  };

  if (!contact) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={email ? "sm:max-w-[640px]" : "sm:max-w-[480px]"}>
        <DialogHeader>
          <DialogTitle>Move {contact.name} to Messaged</DialogTitle>
          <DialogDescription>
            Have you already reached out, or would you like to generate an outreach email?
          </DialogDescription>
        </DialogHeader>

        {!email ? (
          <div className="flex flex-col gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleAlreadyMessaged}
              disabled={generating}
              className="justify-start gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Already Messaged
            </Button>
            <Button
              onClick={handleGenerateEmail}
              disabled={generating}
              className="justify-start gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Outreach Email
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subject</p>
              <p className="text-sm font-medium">{email.subject}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Body</p>
              <div className="text-sm whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 max-h-[50vh] overflow-y-auto">
                {email.body}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              {contact.email && (
                <Button variant="outline" size="sm" onClick={handleOpenInMail} className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in Mail
                </Button>
              )}
              <div className="flex-1" />
              <Button size="sm" onClick={handleDone}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
