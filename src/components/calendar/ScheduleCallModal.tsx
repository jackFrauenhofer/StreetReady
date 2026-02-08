import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Contact } from '@/lib/types';

const scheduleCallSchema = z.object({
  contact_id: z.string().min(1, 'Please select a contact'),
  start_at: z.string().min(1, 'Start time is required'),
  end_at: z.string().min(1, 'End time is required'),
  location: z.string().optional(),
  notes: z.string().optional(),
});

type ScheduleCallFormData = z.infer<typeof scheduleCallSchema>;

interface ScheduleCallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  onSubmit: (data: ScheduleCallFormData & { title: string; sendInvite: boolean }) => Promise<void>;
  gcalConnected?: boolean;
  defaultDate?: Date;
  isSubmitting?: boolean;
  preselectedContactId?: string;
}

export function ScheduleCallModal({
  open,
  onOpenChange,
  contacts,
  onSubmit,
  defaultDate,
  isSubmitting,
  preselectedContactId,
  gcalConnected,
}: ScheduleCallModalProps) {
  const [contactOpen, setContactOpen] = useState(false);
  const [sendInvite, setSendInvite] = useState(false);

  const form = useForm<ScheduleCallFormData>({
    resolver: zodResolver(scheduleCallSchema),
    defaultValues: {
      contact_id: '',
      start_at: '',
      end_at: '',
      location: '',
      notes: '',
    },
  });

  // Set default date/time when modal opens
  useEffect(() => {
    if (open) {
      const dateToUse = defaultDate || new Date();
      // Round to next hour
      const roundedDate = new Date(dateToUse);
      roundedDate.setMinutes(0, 0, 0);
      if (!defaultDate) {
        roundedDate.setHours(roundedDate.getHours() + 1);
      }
      
      const startTime = format(roundedDate, "yyyy-MM-dd'T'HH:mm");
      const endDate = new Date(roundedDate.getTime() + 30 * 60 * 1000);
      const endTime = format(endDate, "yyyy-MM-dd'T'HH:mm");
      
      form.setValue('start_at', startTime);
      form.setValue('end_at', endTime);
      
      // Set preselected contact if provided
      if (preselectedContactId) {
        form.setValue('contact_id', preselectedContactId);
      }
    }
  }, [defaultDate, open, form, preselectedContactId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setSendInvite(false);
    }
  }, [open, form]);

  const handleSubmit = async (data: ScheduleCallFormData) => {
    const selectedContact = contacts.find((c) => c.id === data.contact_id);
    const title = selectedContact
      ? `Call with ${selectedContact.name}`
      : 'Scheduled Call';
    
    await onSubmit({
      ...data,
      title,
      sendInvite,
    });
  };

  const selectedContact = contacts.find((c) => c.id === form.watch('contact_id'));
  const showContactPicker = !preselectedContactId || contacts.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" data-tour="schedule-call-modal">
        <DialogHeader>
          <DialogTitle>
            {preselectedContactId && selectedContact 
              ? `Schedule Call with ${selectedContact.name}`
              : 'Schedule Call'
            }
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {showContactPicker && (
              <FormField
                control={form.control}
                name="contact_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Contact</FormLabel>
                    <Popover open={contactOpen} onOpenChange={setContactOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={contactOpen}
                            className={cn(
                              'w-full justify-between',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {selectedContact
                              ? `${selectedContact.name}${selectedContact.firm ? ` - ${selectedContact.firm}` : ''}`
                              : 'Select contact...'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0 z-50 bg-popover" align="start">
                        <Command>
                          <CommandInput placeholder="Search contacts..." />
                          <CommandList>
                            <CommandEmpty>No contact found.</CommandEmpty>
                            <CommandGroup>
                              {contacts.map((contact) => (
                                <CommandItem
                                  key={contact.id}
                                  value={`${contact.name} ${contact.firm || ''}`}
                                  onSelect={() => {
                                    form.setValue('contact_id', contact.id);
                                    setContactOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      field.value === contact.id ? 'opacity-100' : 'opacity-0'
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>{contact.name}</span>
                                    {contact.firm && (
                                      <span className="text-xs text-muted-foreground">
                                        {contact.firm}
                                      </span>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Zoom, Phone, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Discussion topics, prep notes..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {gcalConnected && selectedContact?.email && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-invite"
                  checked={sendInvite}
                  onCheckedChange={(checked) => setSendInvite(checked === true)}
                />
                <label
                  htmlFor="send-invite"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Send calendar invite to {selectedContact.name} ({selectedContact.email})
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Scheduling...' : 'Schedule Call'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
