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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, CheckCircle, XCircle } from 'lucide-react';
import type { CallEvent, CallEventStatus } from '@/lib/types';

const editCallSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  start_at: z.string().min(1, 'Start time is required'),
  end_at: z.string().min(1, 'End time is required'),
  location: z.string().optional(),
  notes: z.string().optional(),
});

type EditCallFormData = z.infer<typeof editCallSchema>;

type CallEventWithSimpleContact = Omit<CallEvent, 'contact'> & { 
  contact?: { id: string; name: string; firm: string | null } 
};

interface EditCallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CallEventWithSimpleContact | null;
  onSubmit: (id: string, data: Partial<EditCallFormData>) => Promise<void>;
  onStatusChange: (id: string, status: CallEventStatus) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onLogInteraction?: (event: CallEventWithSimpleContact) => void;
  isSubmitting?: boolean;
}

export function EditCallModal({
  open,
  onOpenChange,
  event,
  onSubmit,
  onStatusChange,
  onDelete,
  onLogInteraction,
  isSubmitting,
}: EditCallModalProps) {
  const [showLogPrompt, setShowLogPrompt] = useState(false);

  const form = useForm<EditCallFormData>({
    resolver: zodResolver(editCallSchema),
    defaultValues: {
      title: '',
      start_at: '',
      end_at: '',
      location: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (event && open) {
      form.reset({
        title: event.title,
        start_at: format(new Date(event.start_at), "yyyy-MM-dd'T'HH:mm"),
        end_at: format(new Date(event.end_at), "yyyy-MM-dd'T'HH:mm"),
        location: event.location || '',
        notes: event.notes || '',
      });
    }
  }, [event, open, form]);

  const handleSubmit = async (data: EditCallFormData) => {
    if (!event) return;
    await onSubmit(event.id, data);
    onOpenChange(false);
  };

  const handleMarkCompleted = async () => {
    if (!event) return;
    await onStatusChange(event.id, 'completed');
    setShowLogPrompt(true);
  };

  const handleCancel = async () => {
    if (!event) return;
    await onStatusChange(event.id, 'canceled');
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!event) return;
    await onDelete(event.id);
    onOpenChange(false);
  };

  const handleLogInteraction = () => {
    if (event && onLogInteraction) {
      onLogInteraction(event);
    }
    setShowLogPrompt(false);
    onOpenChange(false);
  };

  const handleSkipLog = () => {
    setShowLogPrompt(false);
    onOpenChange(false);
  };

  if (!event) return null;

  const statusColors: Record<CallEventStatus, string> = {
    scheduled: 'bg-blue-500/10 text-blue-500',
    completed: 'bg-green-500/10 text-green-500',
    canceled: 'bg-muted text-muted-foreground',
  };

  return (
    <>
      <Dialog open={open && !showLogPrompt} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>Edit Call</DialogTitle>
              <Badge className={statusColors[event.status]}>
                {event.status}
              </Badge>
            </div>
            {event.contact && (
              <p className="text-sm text-muted-foreground">
                {event.contact.name}
                {event.contact.firm && ` - ${event.contact.firm}`}
              </p>
            )}
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4 min-w-0">
                <FormField
                  control={form.control}
                  name="start_at"
                  render={({ field }) => (
                    <FormItem className="min-w-0">
                      <FormLabel>Start</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" className="w-full min-w-0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_at"
                  render={({ field }) => (
                    <FormItem className="min-w-0">
                      <FormLabel>End</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" className="w-full min-w-0" {...field} />
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
                    <FormLabel>Location</FormLabel>
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
                    <FormLabel>Notes</FormLabel>
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

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex items-center gap-2">
                  {event.status === 'scheduled' && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleMarkCompleted}
                        className="text-green-600 hover:text-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Complete
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCancel}
                        className="text-muted-foreground"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this call?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this scheduled call. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Log Interaction Prompt */}
      <AlertDialog open={showLogPrompt} onOpenChange={setShowLogPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log call notes?</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to log this call as an interaction with notes? This helps track your relationship history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSkipLog}>Skip</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogInteraction}>
              Log Interaction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
