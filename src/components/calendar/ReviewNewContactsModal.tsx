import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PendingContact, ConfirmedContact } from '@/hooks/useGoogleCalendar';
import type { ConnectionType } from '@/lib/types';

interface ReviewNewContactsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingContacts: PendingContact[];
  onConfirm: (contacts: ConfirmedContact[]) => void;
  isSubmitting: boolean;
}

interface EditableContact {
  email: string;
  name: string;
  firm: string;
  position: string;
  connection_type: ConnectionType;
  selected: boolean;
  gcalEventId: string;
  eventTitle: string;
  startAt: string;
  endAt: string;
  location: string | null;
  notes: string | null;
}

export function ReviewNewContactsModal({
  open,
  onOpenChange,
  pendingContacts,
  onConfirm,
  isSubmitting,
}: ReviewNewContactsModalProps) {
  const [editableContacts, setEditableContacts] = useState<EditableContact[]>(() =>
    pendingContacts.map((pc) => ({
      email: pc.email,
      name: pc.displayName,
      firm: '',
      position: '',
      connection_type: 'cold' as ConnectionType,
      selected: true,
      gcalEventId: pc.gcalEventId,
      eventTitle: pc.eventTitle,
      startAt: pc.startAt,
      endAt: pc.endAt,
      location: pc.location,
      notes: pc.notes,
    })),
  );

  // Reset state when pendingContacts change
  const resetContacts = () => {
    setEditableContacts(
      pendingContacts.map((pc) => ({
        email: pc.email,
        name: pc.displayName,
        firm: '',
        position: '',
        connection_type: 'cold' as ConnectionType,
        selected: true,
        gcalEventId: pc.gcalEventId,
        eventTitle: pc.eventTitle,
        startAt: pc.startAt,
        endAt: pc.endAt,
        location: pc.location,
        notes: pc.notes,
      })),
    );
  };

  const updateContact = (index: number, field: keyof EditableContact, value: string | boolean) => {
    setEditableContacts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const selectedCount = editableContacts.filter((c) => c.selected).length;

  const handleConfirm = () => {
    const confirmed: ConfirmedContact[] = editableContacts
      .filter((c) => c.selected && c.name.trim())
      .map((c) => ({
        name: c.name.trim(),
        email: c.email,
        firm: c.firm.trim() || undefined,
        position: c.position.trim() || undefined,
        connection_type: c.connection_type,
        gcalEventId: c.gcalEventId,
        eventTitle: c.eventTitle,
        startAt: c.startAt,
        endAt: c.endAt,
        location: c.location,
        notes: c.notes,
      }));

    onConfirm(confirmed);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetContacts();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Contacts Found</DialogTitle>
          <DialogDescription>
            The following attendees from your Google Calendar don't match any existing contacts.
            Review and edit their details, or uncheck to skip.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {editableContacts.map((contact, index) => (
              <div
                key={contact.email}
                className={`rounded-lg border p-4 space-y-3 transition-opacity ${
                  !contact.selected ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={contact.selected}
                    onCheckedChange={(checked) =>
                      updateContact(index, 'selected', !!checked)
                    }
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {contact.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      From: {contact.eventTitle} · {new Date(contact.startAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {contact.selected && (
                  <div className="grid grid-cols-2 gap-3 pl-7">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={contact.name}
                        onChange={(e) => updateContact(index, 'name', e.target.value)}
                        placeholder="Contact name"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Firm</Label>
                      <Input
                        value={contact.firm}
                        onChange={(e) => updateContact(index, 'firm', e.target.value)}
                        placeholder="e.g. Goldman Sachs"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Position</Label>
                      <Input
                        value={contact.position}
                        onChange={(e) => updateContact(index, 'position', e.target.value)}
                        placeholder="e.g. VP, Analyst"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Connection Type</Label>
                      <Select
                        value={contact.connection_type}
                        onValueChange={(val) => updateContact(index, 'connection_type', val)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cold">Cold Outreach</SelectItem>
                          <SelectItem value="alumni">Alumni</SelectItem>
                          <SelectItem value="friend">Friend</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {selectedCount} of {editableContacts.length} selected
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Skip All
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isSubmitting || selectedCount === 0}
            >
              {isSubmitting
                ? 'Creating...'
                : `Create ${selectedCount} Contact${selectedCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
