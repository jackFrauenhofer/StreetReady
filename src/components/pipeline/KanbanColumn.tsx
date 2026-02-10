import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { STAGE_CONFIG, type Contact, type ContactStage, type CallEvent } from '@/lib/types';
import { SortableContactCard } from './SortableContactCard';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KanbanColumnProps {
  stage: ContactStage;
  contacts: Contact[];
  scheduledCalls?: Record<string, CallEvent>;
  onEditCall?: (call: CallEvent) => void;
  onColumnClick?: (stage: ContactStage) => void;
  hint?: React.ReactNode;
}

export function KanbanColumn({ stage, contacts, scheduledCalls, onEditCall, onColumnClick, hint }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
  });

  const config = STAGE_CONFIG[stage];

  const handleColumnClick = (e: React.MouseEvent) => {
    // Don't fire when clicking on a contact card or the stage badge header
    const target = e.target as HTMLElement;
    if (target.closest('[data-contact-card]') || target.closest('.stage-badge') || target.closest('[data-column-hint]')) return;
    onColumnClick?.(stage);
  };

  return (
    <div
      ref={setNodeRef}
      data-tour={`${stage}-column`}
      className={cn(
        'flex flex-col h-full bg-muted/40 rounded-xl border border-border/50 p-3 cursor-pointer',
        isOver && 'ring-2 ring-primary/30 bg-muted/60'
      )}
      onClick={handleColumnClick}
    >
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <span className={cn('stage-badge', config.className)}>
          {config.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {contacts.length}
        </span>
      </div>

      <SortableContext
        items={contacts.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className="space-y-2 pb-2">
            {contacts.map((contact) => (
              <SortableContactCard 
                key={contact.id} 
                contact={contact}
                scheduledCall={scheduledCalls?.[contact.id]}
                onEditCall={onEditCall}
              />
            ))}
          </div>
          {hint}
        </ScrollArea>
      </SortableContext>
    </div>
  );
}
