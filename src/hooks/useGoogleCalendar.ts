import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export interface GCalEvent {
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string | null;
  end: string | null;
  htmlLink: string | null;
  status: string;
}

export function useGoogleCalendar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if user has connected Google Calendar
  const { data: isConnected = false, isLoading: isCheckingConnection } = useQuery({
    queryKey: ['google-calendar-connected', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from('user_google_tokens')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        console.error('Error checking Google Calendar connection:', error);
        return false;
      }
      return !!data;
    },
    enabled: !!user,
  });

  // Start the OAuth flow
  const connectGoogleCalendar = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('Not logged in');

    const redirectUri = `${SUPABASE_URL}/functions/v1/gcal-oauth-callback`;

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      access_type: 'offline',
      prompt: 'consent',
      state: accessToken,
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  // Disconnect Google Calendar
  const disconnectGoogleCalendar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not logged in');
      const { error } = await supabase
        .from('user_google_tokens')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-connected', user?.id] });
    },
  });

  // Push a call event to Google Calendar
  const pushToGoogleCalendar = useMutation({
    mutationFn: async ({
      callEventId,
      action,
    }: {
      callEventId: string;
      action: 'create' | 'update' | 'delete';
    }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Not logged in');

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/gcal-push-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ callEventId, action }),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        console.error('GCal push failed:', resp.status, errBody);
        throw new Error(`Google Calendar sync failed (${resp.status})`);
      }

      return resp.json();
    },
  });

  // Fetch Google Calendar events for a date range (read-only overlay)
  const fetchGoogleEvents = async (timeMin: string, timeMax: string): Promise<GCalEvent[]> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return [];

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/gcal-list-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ timeMin, timeMax }),
    });

    if (!resp.ok) {
      console.error('Failed to fetch GCal events:', resp.status);
      return [];
    }

    const data = await resp.json();
    return data.events ?? [];
  };

  return {
    isConnected,
    isCheckingConnection,
    connectGoogleCalendar,
    disconnectGoogleCalendar,
    pushToGoogleCalendar,
    fetchGoogleEvents,
  };
}
