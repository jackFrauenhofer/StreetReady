import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Contact, ContactStage } from '@/lib/types';

export function useContacts(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Contact[];
    },
    enabled: !!userId,
  });

  const createContact = useMutation({
    mutationFn: async (contact: Omit<Contact, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!userId) throw new Error('No user ID');
      
      // Set next_followup_at to 7 days from now if not specified
      const nextFollowup = contact.next_followup_at || 
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          ...contact,
          user_id: userId,
          next_followup_at: nextFollowup,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
    },
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contact> & { id: string }) => {
      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
      queryClient.invalidateQueries({ queryKey: ['contact', data.id] });
      queryClient.invalidateQueries({ queryKey: ['upcomingCalls', userId] });
    },
  });

  const updateContactStage = useMutation({
    mutationFn: async ({ id, stage, deleteScheduledCall = false }: { id: string; stage: ContactStage; deleteScheduledCall?: boolean }) => {
      // If moving to call_done, mark any scheduled calls as completed
      if (stage === 'call_done') {
        await supabase
          .from('call_events')
          .update({ status: 'completed' })
          .eq('contact_id', id)
          .eq('status', 'scheduled');
      }
      
      // If moving away from scheduled and requested to delete, delete the scheduled call event
      if (deleteScheduledCall) {
        await supabase
          .from('call_events')
          .delete()
          .eq('contact_id', id)
          .eq('status', 'scheduled');
      }

      const { data, error } = await supabase
        .from('contacts')
        .update({ stage })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
      queryClient.invalidateQueries({ queryKey: ['callEvents', userId] });
      queryClient.invalidateQueries({ queryKey: ['upcomingCalls', userId] });
    },
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
    },
  });

  return {
    contacts,
    isLoading,
    createContact,
    updateContact,
    updateContactStage,
    deleteContact,
  };
}

export function useContact(contactId: string | undefined) {
  return useQuery({
    queryKey: ['contact', contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();
      if (error) throw error;
      return data as Contact;
    },
    enabled: !!contactId,
  });
}
