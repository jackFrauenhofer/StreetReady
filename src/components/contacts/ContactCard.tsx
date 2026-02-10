import { forwardRef } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Building2, Clock, CalendarClock, Phone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { RelationshipStrength } from './RelationshipStrength';
import type { Contact, CallEvent } from '@/lib/types';

interface ContactCardProps {
  contact: Contact;
  scheduledCall?: CallEvent;
  onEditCall?: (call: CallEvent) => void;
}

export const ContactCard = forwardRef<HTMLDivElement, ContactCardProps>(
  function ContactCard({ contact, scheduledCall, onEditCall }, ref) {
    const navigate = useNavigate();

    const lastContacted = contact.last_contacted_at
      ? formatDistanceToNow(new Date(contact.last_contacted_at), { addSuffix: true })
      : 'Never';

    const handleCallClick = (e: React.MouseEvent) => {
      if (scheduledCall && onEditCall) {
        e.stopPropagation();
        onEditCall(scheduledCall);
      }
    };

    return (
      <Card
        ref={ref}
        className="contact-card group"
        onClick={() => navigate(`/contact/${contact.id}`)}
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <h4 className="font-medium text-foreground truncate">{contact.name}</h4>
            <RelationshipStrength strength={contact.relationship_strength} />
          </div>

          {(contact.firm || contact.position) && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {contact.position && contact.firm
                  ? `${contact.position} @ ${contact.firm}`
                  : contact.firm || contact.position}
              </span>
            </div>
          )}

          {contact.phone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />
              <span className="truncate">{contact.phone}</span>
            </div>
          )}

          {/* Show scheduled call time if available */}
          {scheduledCall && (
            <div 
              className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline cursor-pointer"
              onClick={handleCallClick}
              title="Click to edit call"
            >
              <CalendarClock className="h-3 w-3 shrink-0" />
              <span>{format(new Date(scheduledCall.start_at), 'MMM d, h:mm a')}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{lastContacted}</span>
          </div>
        </div>
      </Card>
    );
  }
);
