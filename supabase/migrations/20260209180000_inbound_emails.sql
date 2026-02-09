-- Inbound email scheduling: stores raw webhook payloads and parsed LLM results

CREATE TYPE public.inbound_email_status AS ENUM ('processed', 'needs_confirmation', 'failed', 'ignored');

CREATE TABLE public.inbound_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    from_address TEXT NOT NULL,
    to_address TEXT,
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    raw_payload JSONB,
    parsed_result JSONB,
    status public.inbound_email_status NOT NULL DEFAULT 'failed',
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    call_event_id UUID REFERENCES public.call_events(id) ON DELETE SET NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;

-- Users can view their own inbound emails
CREATE POLICY "Users can view their own inbound emails" ON public.inbound_emails
    FOR SELECT USING (auth.uid() = user_id);

-- Service role inserts (webhook has no user JWT) — no INSERT policy needed for service role

-- Indexes
CREATE INDEX idx_inbound_emails_user_id ON public.inbound_emails(user_id);
CREATE INDEX idx_inbound_emails_status ON public.inbound_emails(status);
CREATE INDEX idx_inbound_emails_created_at ON public.inbound_emails(created_at);
