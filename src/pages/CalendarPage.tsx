import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, EventInput } from '@fullcalendar/core';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useContacts } from '@/hooks/useContacts';
import { useCallEvents } from '@/hooks/useCallEvents';
import { useInteractions } from '@/hooks/useInteractions';
import { useGoogleCalendar, type GCalEvent, type PendingContact } from '@/hooks/useGoogleCalendar';
import { ReviewNewContactsModal } from '@/components/calendar/ReviewNewContactsModal';
import { ScheduleCallModal } from '@/components/calendar/ScheduleCallModal';
import { EditCallModal } from '@/components/calendar/EditCallModal';
import { Button } from '@/components/ui/button';
import type { CallEvent, CallEventStatus } from '@/lib/types';

export function CalendarPage() {
  const { user } = useAuth();
  const { contacts } = useContacts(user?.id);
  const { callEvents, isLoading, createCallEvent, updateCallEvent, updateCallEventStatus, deleteCallEvent } = useCallEvents(user?.id);
  const { createInteraction } = useInteractions(user?.id, undefined);
  const { isConnected: gcalConnected, isCheckingConnection, connectGoogleCalendar, disconnectGoogleCalendar, pushToGoogleCalendar, fetchGoogleEvents, syncGcalCalls, confirmContacts } = useGoogleCalendar();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle OAuth redirect query params
  useEffect(() => {
    if (searchParams.get('gcal_connected') === 'true') {
      toast.success('Google Calendar connected!');
      searchParams.delete('gcal_connected');
      setSearchParams(searchParams, { replace: true });
    }
    const gcalError = searchParams.get('gcal_error');
    if (gcalError) {
      toast.error(`Google Calendar error: ${gcalError}`);
      searchParams.delete('gcal_error');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedEvent, setSelectedEvent] = useState<(CallEvent & { contact?: { id: string; name: string; firm: string | null } }) | null>(null);
  const [gcalEvents, setGcalEvents] = useState<GCalEvent[]>([]);
  const [pendingContacts, setPendingContacts] = useState<PendingContact[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // Fetch Google Calendar events for the visible date range
  const loadGcalEvents = useCallback(async (start: Date, end: Date) => {
    if (!gcalConnected) {
      setGcalEvents([]);
      return;
    }
    try {
      const events = await fetchGoogleEvents(start.toISOString(), end.toISOString());
      setGcalEvents(events);
    } catch {
      console.warn('Failed to load Google Calendar events');
    }
  }, [gcalConnected, fetchGoogleEvents]);

  // Load GCal events on initial render and when connection status changes
  useEffect(() => {
    if (gcalConnected) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      loadGcalEvents(start, end);
    } else {
      setGcalEvents([]);
    }
  }, [gcalConnected, loadGcalEvents]);

  // Get the set of GCal event IDs that were pushed from OfferReady
  const pushedGcalIds = useMemo(() => {
    return new Set(
      callEvents
        .filter((e) => e.external_provider === 'google' && e.external_event_id)
        .map((e) => e.external_event_id!),
    );
  }, [callEvents]);

  const events: EventInput[] = useMemo(() => {
    // OfferReady call events
    const srEvents: EventInput[] = callEvents.map((event) => {
      const contact = event.contact;
      const displayTitle = contact
        ? `${contact.name}${contact.firm ? ` - ${contact.firm}` : ''}`
        : event.title;

      const colorMap: Record<CallEventStatus, string> = {
        scheduled: 'hsl(var(--primary))',
        completed: 'hsl(142 76% 36%)',
        canceled: 'hsl(var(--muted-foreground))',
      };

      return {
        id: event.id,
        title: displayTitle,
        start: event.start_at,
        end: event.end_at,
        backgroundColor: colorMap[event.status],
        borderColor: colorMap[event.status],
        extendedProps: {
          ...event,
          source: 'offerready',
        },
      };
    });

    // Google Calendar overlay events (read-only, skip duplicates already pushed from SR)
    const overlayEvents: EventInput[] = gcalEvents
      .filter((ge) => ge.status !== 'cancelled' && !pushedGcalIds.has(ge.id))
      .map((ge) => ({
        id: `gcal-${ge.id}`,
        title: `📅 ${ge.summary}`,
        start: ge.start ?? undefined,
        end: ge.end ?? undefined,
        backgroundColor: '#4285F4',
        borderColor: '#3367D6',
        editable: false,
        extendedProps: {
          source: 'google',
          htmlLink: ge.htmlLink,
          description: ge.description,
          location: ge.location,
        },
      }));

    return [...srEvents, ...overlayEvents];
  }, [callEvents, gcalEvents, pushedGcalIds]);

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    setSelectedDate(selectInfo.start);
    setScheduleModalOpen(true);
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const source = clickInfo.event.extendedProps?.source;

    // Google Calendar events open in a new tab
    if (source === 'google') {
      const htmlLink = clickInfo.event.extendedProps?.htmlLink;
      if (htmlLink) {
        window.open(htmlLink, '_blank', 'noopener');
      }
      return;
    }

    const eventData = clickInfo.event.extendedProps as CallEvent & { contact?: { id: string; name: string; firm: string | null } };
    setSelectedEvent({
      ...eventData,
      id: clickInfo.event.id,
    });
    setEditModalOpen(true);
  };

  const handleScheduleCall = async (data: {
    contact_id: string;
    title: string;
    start_at: string;
    end_at: string;
    location?: string;
    notes?: string;
  }) => {
    try {
      const result = await createCallEvent.mutateAsync({
        contact_id: data.contact_id,
        title: data.title,
        start_at: new Date(data.start_at).toISOString(),
        end_at: new Date(data.end_at).toISOString(),
        location: data.location || null,
        notes: data.notes || null,
        status: 'scheduled',
        external_provider: null,
        external_event_id: null,
        updateContactStage: true, // Sync with pipeline
      });
      toast.success('Call scheduled - contact moved to Scheduled stage');
      setScheduleModalOpen(false);

      // Push to Google Calendar if connected
      if (gcalConnected && result) {
        pushToGoogleCalendar.mutate(
          { callEventId: result.id, action: 'create' },
          {
            onSuccess: () => toast.success('Added to Google Calendar'),
            onError: () => toast.error('Failed to sync with Google Calendar'),
          },
        );
      }
    } catch (error) {
      toast.error('Failed to schedule call');
    }
  };

  const handleUpdateCall = async (id: string, data: Partial<{
    title: string;
    start_at: string;
    end_at: string;
    location: string;
    notes: string;
  }>) => {
    try {
      await updateCallEvent.mutateAsync({
        id,
        title: data.title,
        start_at: data.start_at ? new Date(data.start_at).toISOString() : undefined,
        end_at: data.end_at ? new Date(data.end_at).toISOString() : undefined,
        location: data.location || null,
        notes: data.notes || null,
      });
      toast.success('Call updated');

      // Push update to Google Calendar if connected
      if (gcalConnected) {
        pushToGoogleCalendar.mutate(
          { callEventId: id, action: 'update' },
          {
            onSuccess: () => toast.success('Google Calendar updated'),
            onError: () => toast.error('Failed to sync update with Google Calendar'),
          },
        );
      }
    } catch (error) {
      toast.error('Failed to update call');
    }
  };

  const handleStatusChange = async (id: string, status: CallEventStatus) => {
    try {
      await updateCallEventStatus.mutateAsync({ id, status, updateContactStage: true });
      if (status === 'completed') {
        toast.success('Call completed - contact moved to Call Done stage');
      } else {
        toast.success(`Call marked as ${status}`);
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteCall = async (id: string) => {
    try {
      // Delete from Google Calendar first if connected
      if (gcalConnected) {
        try {
          await pushToGoogleCalendar.mutateAsync({ callEventId: id, action: 'delete' });
        } catch {
          // Non-blocking — still delete locally
          console.warn('Failed to delete from Google Calendar');
        }
      }
      await deleteCallEvent.mutateAsync(id);
      toast.success('Call deleted');
    } catch (error) {
      toast.error('Failed to delete call');
    }
  };

  const handleLogInteraction = async (event: { contact_id: string; start_at: string; notes: string | null }) => {
    try {
      await createInteraction.mutateAsync({
        contact_id: event.contact_id,
        type: 'call',
        date: event.start_at,
        notes: event.notes,
      });
      toast.success('Interaction logged');
    } catch (error) {
      toast.error('Failed to log interaction');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
          <p className="text-muted-foreground">Schedule and manage your calls</p>
        </div>
        <div>
          {!isCheckingConnection && (
            gcalConnected ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                  Google Calendar connected
                </span>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
                    const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()).toISOString();
                    syncGcalCalls.mutate(
                      { timeMin, timeMax },
                      {
                        onSuccess: (data) => {
                          if (data.synced > 0) {
                            toast.success(
                              `Synced ${data.synced} call${data.synced > 1 ? 's' : ''} to pipeline`,
                            );
                          }
                          if (data.pending_contacts && data.pending_contacts.length > 0) {
                            setPendingContacts(data.pending_contacts);
                            setReviewModalOpen(true);
                          } else if (data.synced === 0) {
                            toast.info('No new calls to sync');
                          }
                        },
                        onError: () => toast.error('Failed to sync calls from Google Calendar'),
                      },
                    );
                  }}
                  disabled={syncGcalCalls.isPending}
                >
                  {syncGcalCalls.isPending ? 'Syncing...' : 'Sync Calls to Pipeline'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectGoogleCalendar.mutate(undefined, {
                    onSuccess: () => toast.success('Google Calendar disconnected'),
                    onError: () => toast.error('Failed to disconnect'),
                  })}
                  disabled={disconnectGoogleCalendar.isPending}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={connectGoogleCalendar}
                className="gap-2"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <path d="M6 2h12v4H6V2z" fill="#4285F4"/>
                  <path d="M18 6v12H6V6h12z" fill="#FBBC04"/>
                  <path d="M6 18h12v4H6v-4z" fill="#34A853"/>
                  <path d="M2 6h4v12H2V6z" fill="#EA4335"/>
                  <path d="M18 6h4v12h-4V6z" fill="#4285F4"/>
                </svg>
                Connect Google Calendar
              </Button>
            )
          )}
        </div>
      </div>

      <div className="bg-card rounded-lg border p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={events}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          select={handleDateSelect}
          eventClick={handleEventClick}
          datesSet={(dateInfo) => {
            loadGcalEvents(dateInfo.start, dateInfo.end);
          }}
          height="auto"
          eventDisplay="block"
          eventTimeFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short',
          }}
        />
      </div>

      <ScheduleCallModal
        open={scheduleModalOpen}
        onOpenChange={setScheduleModalOpen}
        contacts={contacts}
        onSubmit={handleScheduleCall}
        defaultDate={selectedDate}
        isSubmitting={createCallEvent.isPending}
      />

      <EditCallModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        event={selectedEvent}
        onSubmit={handleUpdateCall}
        onStatusChange={handleStatusChange}
        onDelete={handleDeleteCall}
        onLogInteraction={handleLogInteraction}
        isSubmitting={updateCallEvent.isPending}
      />

      <ReviewNewContactsModal
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
        pendingContacts={pendingContacts}
        onConfirm={(confirmed) => {
          confirmContacts.mutate(confirmed, {
            onSuccess: (data) => {
              toast.success(
                `Created ${data.created} contact${data.created !== 1 ? 's' : ''} and synced to pipeline`,
              );
              setReviewModalOpen(false);
              setPendingContacts([]);
            },
            onError: () => toast.error('Failed to create contacts'),
          });
        }}
        isSubmitting={confirmContacts.isPending}
      />
    </div>
  );
}
