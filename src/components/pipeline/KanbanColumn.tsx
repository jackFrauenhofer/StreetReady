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
}

export function KanbanColumn({ stage, contacts, scheduledCalls, onEditCall }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
  });

  const config = STAGE_CONFIG[stage];

  return (
    <div
      ref={setNodeRef}
      data-tour={`${stage}-column`}
      className={cn(
        'flex flex-col h-full bg-muted/40 rounded-xl border border-border/50 p-3',
        isOver && 'ring-2 ring-primary/30 bg-muted/60'
      )}
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
            {contacts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No contacts
              </p>
            ) : (
              contacts.map((contact) => (
                <SortableContactCard 
                  key={contact.id} 
                  contact={contact}
                  scheduledCall={scheduledCalls?.[contact.id]}
                  onEditCall={onEditCall}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </SortableContext>
    </div>
  );
}
