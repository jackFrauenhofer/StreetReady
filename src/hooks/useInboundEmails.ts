import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InboundEmail {
  id: string;
  user_id: string | null;
  from_address: string;
  to_address: string | null;
  subject: string | null;
  status: 'processed' | 'needs_confirmation' | 'failed' | 'ignored';
  contact_id: string | null;
  call_event_id: string | null;
  error_message: string | null;
  parsed_result: Record<string, unknown> | null;
  created_at: string;
}

export function useInboundEmails(userId: string | undefined) {
  const { data: inboundEmails = [], isLoading } = useQuery({
    queryKey: ['inbound_emails', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('inbound_emails')
        .select('id, user_id, from_address, to_address, subject, status, contact_id, call_event_id, error_message, parsed_result, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as InboundEmail[];
    },
    enabled: !!userId,
  });

  return { inboundEmails, isLoading };
}
