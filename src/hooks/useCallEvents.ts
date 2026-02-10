import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CallEvent, CallEventStatus } from '@/lib/types';

export function useCallEvents(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: callEvents = [], isLoading } = useQuery({
    queryKey: ['callEvents', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('call_events')
        .select(`
          *,
          contact:contacts(id, name, firm, position, stage)
        `)
        .eq('user_id', userId)
        .order('start_at', { ascending: true });
      if (error) throw error;
      return data as (CallEvent & { contact: { id: string; name: string; firm: string | null; position: string | null; stage: string } })[];
    },
    enabled: !!userId,
  });

  const createCallEvent = useMutation({
    mutationFn: async (event: Omit<CallEvent, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'contact'> & { updateContactStage?: boolean }) => {
      if (!userId) throw new Error('No user ID');
      
      const { updateContactStage, ...eventData } = event;
      
      // Create the call event
      const { data, error } = await supabase
        .from('call_events')
        .insert({
          ...eventData,
          user_id: userId,
        })
        .select()
        .single();
      if (error) throw error;

      // If requested, update contact stage to 'scheduled'
      if (updateContactStage !== false) {
        await supabase
          .from('contacts')
          .update({ stage: 'scheduled' })
          .eq('id', eventData.contact_id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callEvents', userId] });
      queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
    },
  });

  const updateCallEvent = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CallEvent> & { id: string }) => {
      const { data, error } = await supabase
        .from('call_events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callEvents', userId] });
    },
  });

  const updateCallEventStatus = useMutation({
    mutationFn: async ({ id, status, updateContactStage = true }: { id: string; status: CallEventStatus; updateContactStage?: boolean }) => {
      // First get the call event to know the contact_id
      const { data: callEvent, error: fetchError } = await supabase
        .from('call_events')
        .select('contact_id')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;

      // Update the call event status
      const { data, error } = await supabase
        .from('call_events')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // If completed, update contact stage to 'call_done'
      if (updateContactStage && status === 'completed' && callEvent) {
        await supabase
          .from('contacts')
          .update({ stage: 'call_done', last_contacted_at: new Date().toISOString() })
          .eq('id', callEvent.contact_id);
      }

      // If canceled, move contact back to 'messaged'
      if (updateContactStage && status === 'canceled' && callEvent) {
        await supabase
          .from('contacts')
          .update({ stage: 'messaged' })
          .eq('id', callEvent.contact_id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callEvents', userId] });
      queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
    },
  });

  const deleteCallEvent = useMutation({
    mutationFn: async (id: string) => {
      // Get the call event first to know the contact_id and status
      const { data: callEvent, error: fetchError } = await supabase
        .from('call_events')
        .select('contact_id, status')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('call_events')
        .delete()
        .eq('id', id);
      if (error) throw error;

      // If the deleted call was scheduled, move the contact back to 'researching'
      if (callEvent && callEvent.status === 'scheduled') {
        await supabase
          .from('contacts')
          .update({ stage: 'researching' })
          .eq('id', callEvent.contact_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callEvents', userId] });
      queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
    },
  });

  // Get scheduled call for a specific contact
  const getScheduledCallForContact = (contactId: string) => {
    return callEvents.find(
      (event) => event.contact_id === contactId && event.status === 'scheduled'
    );
  };

  return {
    callEvents,
    isLoading,
    createCallEvent,
    updateCallEvent,
    updateCallEventStatus,
    deleteCallEvent,
    getScheduledCallForContact,
  };
}

export function useUpcomingCalls(userId: string | undefined, days: number = 7) {
  return useQuery({
    queryKey: ['upcomingCalls', userId, days],
    queryFn: async () => {
      if (!userId) return [];
      const now = new Date();
      const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      
      const { data, error } = await supabase
        .from('call_events')
        .select(`
          *,
          contact:contacts(id, name, firm, position, group_name, connection_type, notes_summary, prep_questions_json)
        `)
        .eq('user_id', userId)
        .eq('status', 'scheduled')
        .gte('start_at', now.toISOString())
        .lte('start_at', futureDate.toISOString())
        .order('start_at', { ascending: true });
      if (error) throw error;
      return data as (CallEvent & { contact: { id: string; name: string; firm: string | null; position: string | null; group_name: string | null; connection_type: string | null; notes_summary: string | null; prep_questions_json: unknown[] | null } })[];
    },
    enabled: !!userId,
  });
}

// Hook to get scheduled calls mapped by contact ID for easy lookup
export function useScheduledCallsByContact(userId: string | undefined) {
  const { callEvents } = useCallEvents(userId);
  
  const scheduledCallsByContact = callEvents
    .filter((event) => event.status === 'scheduled')
    .reduce((acc, event) => {
      acc[event.contact_id] = event;
      return acc;
    }, {} as Record<string, CallEvent & { contact: { id: string; name: string; firm: string | null; position: string | null; stage: string } }>);
  
  return scheduledCallsByContact;
}
