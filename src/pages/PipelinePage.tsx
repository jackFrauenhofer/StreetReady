import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  pointerWithin,
  type CollisionDetection,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useContacts } from '@/hooks/useContacts';
import { useCallEvents, useScheduledCallsByContact } from '@/hooks/useCallEvents';
import { useInteractions } from '@/hooks/useInteractions';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { AddContactModal } from '@/components/contacts/AddContactModal';
import { CallNotesModal } from '@/components/contacts/CallNotesModal';
import { ScheduleCallModal } from '@/components/calendar/ScheduleCallModal';
import { EditCallModal } from '@/components/calendar/EditCallModal';
import { KanbanColumn } from '@/components/pipeline/KanbanColumn';
import { ContactCard } from '@/components/contacts/ContactCard';
import { type Contact, type ContactStage, type CallEvent, type CallEventStatus } from '@/lib/types';

// Simplified pipeline stages
const PIPELINE_STAGES: ContactStage[] = ['researching', 'messaged', 'scheduled', 'call_done'];

export function PipelinePage() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { contacts, updateContactStage, isLoading } = useContacts(user?.id);
  const { createCallEvent, updateCallEvent, updateCallEventStatus, deleteCallEvent } = useCallEvents(user?.id);
  const scheduledCallsByContact = useScheduledCallsByContact(user?.id);
  const { createInteraction } = useInteractions(user?.id, undefined);
  const { isConnected: gcalConnected, pushToGoogleCalendar } = useGoogleCalendar();
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Call notes modal state
  const [callNotesModal, setCallNotesModal] = useState<{
    open: boolean;
    contactId: string;
    contactName: string;
  }>({ open: false, contactId: '', contactName: '' });
  
  // Schedule call modal state (for moving to 'scheduled' stage)
  const [scheduleModal, setScheduleModal] = useState<{
    open: boolean;
    contact: Contact | null;
  }>({ open: false, contact: null });

  // Edit call modal state (for editing scheduled calls from pipeline)
  const [editCallModal, setEditCallModal] = useState<{
    open: boolean;
    event: (Omit<CallEvent, 'contact'> & { contact?: { id: string; name: string; firm: string | null } }) | null;
  }>({ open: false, event: null });
  
  const [pendingStageUpdate, setPendingStageUpdate] = useState<{
    id: string;
    stage: ContactStage;
    deleteScheduledCall?: boolean;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Prefer the column droppable when the pointer is inside a column,
  // otherwise dnd-kit often resolves "over" to the closest card (commonly in the origin column).
  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);

    if (pointerCollisions.length) {
      const stageCollision = pointerCollisions.find((c) =>
        PIPELINE_STAGES.includes(c.id as ContactStage)
      );
      return stageCollision ? [stageCollision] : pointerCollisions;
    }

    return closestCorners(args);
  };

  // Filter contacts by search query
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(query) ||
        contact.firm?.toLowerCase().includes(query) ||
        contact.position?.toLowerCase().includes(query) ||
        contact.email?.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  const contactsByStage = useMemo(() => {
    const grouped: Record<ContactStage, Contact[]> = {
      researching: [],
      messaged: [],
      scheduled: [],
      call_done: [],
      strong_connection: [],
      referral_requested: [],
      interview: [],
      offer: [],
    };

    filteredContacts.forEach((contact) => {
      grouped[contact.stage].push(contact);
    });

    return grouped;
  }, [filteredContacts]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const contact = contacts.find((c) => c.id === active.id);
    if (contact) {
      setActiveContact(contact);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveContact(null);

    if (!over) return;

    const contactId = active.id as string;
    const overId = over.id as string;

    // Determine the target stage - either the column itself or find which column the target card is in
    let newStage: ContactStage;
    
    // Check if overId is a stage (column)
    if (PIPELINE_STAGES.includes(overId as ContactStage)) {
      newStage = overId as ContactStage;
    } else {
      // overId is a contact ID - find which stage that contact is in
      const targetContact = contacts.find((c) => c.id === overId);
      if (!targetContact) return;
      newStage = targetContact.stage;
    }

    const contact = contacts.find((c) => c.id === contactId);
    if (contact && contact.stage !== newStage) {
      // If moving to scheduled, prompt for call scheduling
      if (newStage === 'scheduled') {
        setScheduleModal({ open: true, contact });
        return;
      }
      
      // Check if moving FROM scheduled - need to delete the call event
      const isMovingFromScheduled = contact.stage === 'scheduled';
      
      // If moving to call_done, prompt for notes first
      if (newStage === 'call_done') {
        setCallNotesModal({
          open: true,
          contactId: contact.id,
          contactName: contact.name,
        });
        setPendingStageUpdate({ id: contactId, stage: newStage, deleteScheduledCall: isMovingFromScheduled });
      } else {
        // Delete the scheduled call if moving away from scheduled stage
        updateContactStage.mutate({ 
          id: contactId, 
          stage: newStage,
          deleteScheduledCall: isMovingFromScheduled,
        });
      }
    }
  };

  const handleCallNotesComplete = () => {
    if (pendingStageUpdate) {
      updateContactStage.mutate(pendingStageUpdate);
      setPendingStageUpdate(null);
    }
  };

  const handleScheduleCall = async (data: {
    contact_id: string;
    title: string;
    start_at: string;
    end_at: string;
    location?: string;
    notes?: string;
    sendInvite: boolean;
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
        updateContactStage: true,
      });
      toast.success('Call scheduled');
      setScheduleModal({ open: false, contact: null });

      // Push to Google Calendar if connected
      if (gcalConnected && result) {
        const contact = contacts.find((c) => c.id === data.contact_id);
        const attendeeEmail = data.sendInvite && contact?.email ? contact.email : undefined;
        pushToGoogleCalendar.mutate(
          { callEventId: result.id, action: 'create', attendeeEmail },
          {
            onSuccess: () => {
              toast.success(attendeeEmail ? 'Added to Google Calendar — invite sent!' : 'Added to Google Calendar');
            },
            onError: () => toast.error('Failed to sync with Google Calendar'),
          },
        );
      }
    } catch (error) {
      toast.error('Failed to schedule call');
    }
  };

  const handleEditCall = (call: CallEvent) => {
    const contact = contacts.find((c) => c.id === call.contact_id);
    const contactInfo: { id: string; name: string; firm: string | null } | undefined = contact 
      ? { id: contact.id, name: contact.name, firm: contact.firm } 
      : undefined;
    setEditCallModal({
      open: true,
      event: {
        ...call,
        contact: contactInfo,
      },
    });
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
    } catch (error) {
      toast.error('Failed to update call');
    }
  };

  const handleStatusChange = async (id: string, status: CallEventStatus) => {
    try {
      await updateCallEventStatus.mutateAsync({ id, status, updateContactStage: true });
      if (status === 'completed') {
        toast.success('Call completed');
      } else {
        toast.success(`Call marked as ${status}`);
      }
      setEditCallModal({ open: false, event: null });
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteCall = async (id: string) => {
    try {
      await deleteCallEvent.mutateAsync(id);
      toast.success('Call deleted');
      setEditCallModal({ open: false, event: null });
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
        <div className="animate-pulse text-muted-foreground">Loading pipeline...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
          <p className="text-muted-foreground">
            {filteredContacts.length} contacts{searchQuery && ` matching "${searchQuery}"`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <div data-tour="add-contact-btn">
            <AddContactModal />
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-4 gap-4 flex-1 min-h-0">
          <KanbanColumn
            stage="researching"
            contacts={contactsByStage.researching}
          />
          <div data-tour="messaged-scheduled-columns" className="col-span-2 grid grid-cols-2 gap-4">
            <KanbanColumn
              stage="messaged"
              contacts={contactsByStage.messaged}
            />
            <KanbanColumn
              stage="scheduled"
              contacts={contactsByStage.scheduled}
              scheduledCalls={scheduledCallsByContact}
              onEditCall={handleEditCall}
            />
          </div>
          <KanbanColumn
            stage="call_done"
            contacts={contactsByStage.call_done}
          />
        </div>

        <DragOverlay>
          {activeContact ? <ContactCard contact={activeContact} /> : null}
        </DragOverlay>
      </DndContext>

      <CallNotesModal
        open={callNotesModal.open}
        onOpenChange={(open) => {
          setCallNotesModal((prev) => ({ ...prev, open }));
          if (!open && pendingStageUpdate) {
            // If modal closed without completing, still update stage
            updateContactStage.mutate(pendingStageUpdate);
            setPendingStageUpdate(null);
          }
        }}
        contactId={callNotesModal.contactId}
        contactName={callNotesModal.contactName}
        onComplete={handleCallNotesComplete}
      />

      {/* Schedule Call Modal for pipeline integration */}
      <ScheduleCallModal
        open={scheduleModal.open}
        onOpenChange={(open) => {
          if (!open) {
            setScheduleModal({ open: false, contact: null });
          }
        }}
        contacts={scheduleModal.contact ? [scheduleModal.contact] : contacts}
        onSubmit={handleScheduleCall}
        isSubmitting={createCallEvent.isPending}
        preselectedContactId={scheduleModal.contact?.id}
        gcalConnected={gcalConnected}
        userName={profile?.name || undefined}
      />

      {/* Edit Call Modal for editing scheduled calls from pipeline */}
      <EditCallModal
        open={editCallModal.open}
        onOpenChange={(open) => {
          if (!open) {
            setEditCallModal({ open: false, event: null });
          }
        }}
        event={editCallModal.event}
        onSubmit={handleUpdateCall}
        onStatusChange={handleStatusChange}
        onDelete={handleDeleteCall}
        onLogInteraction={handleLogInteraction}
        isSubmitting={updateCallEvent.isPending}
      />
    </div>
  );
}
