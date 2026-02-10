import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ContactCard } from '@/components/contacts/ContactCard';
import type { Contact, CallEvent } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SortableContactCardProps {
  contact: Contact;
  scheduledCall?: CallEvent;
  onEditCall?: (call: CallEvent) => void;
}

export function SortableContactCard({ contact, scheduledCall, onEditCall }: SortableContactCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: contact.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-contact-card
      className={cn(
        isDragging && 'opacity-50'
      )}
    >
      <ContactCard contact={contact} scheduledCall={scheduledCall} onEditCall={onEditCall} />
    </div>
  );
}
