import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useContacts } from '@/hooks/useContacts';
import { useAuth } from '@/hooks/useAuth';
import { CONNECTION_TYPES, type ConnectionType, type ContactStage } from '@/lib/types';
import { toast } from 'sonner';
import { useSubscription, type UsageData } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/paywall/PaywallModal';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  firm: z.string().optional(),
  group_name: z.string().optional(),
  position: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  connection_type: z.enum(['cold', 'alumni', 'friend', 'referral']),
  notes_summary: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface AddContactModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultStage?: ContactStage;
  onContactCreated?: (contact: { id: string; name: string; firm: string | null; email: string | null; stage: ContactStage }) => void;
  showTrigger?: boolean;
}

export function AddContactModal({ open: controlledOpen, onOpenChange: controlledOnOpenChange, defaultStage, onContactCreated, showTrigger = true }: AddContactModalProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? setInternalOpen) : setInternalOpen;
  const { user } = useAuth();
  const { createContact } = useContacts(user?.id);
  const { checkUsage } = useSubscription();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallUsage, setPaywallUsage] = useState<UsageData | null>(null);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      firm: '',
      group_name: '',
      position: '',
      email: '',
      connection_type: 'cold',
      notes_summary: '',
    },
  });

  const handleOpenChange = async (newOpen: boolean) => {
    if (newOpen) {
      const result = await checkUsage('contact');
      if (!result.allowed) {
        setPaywallUsage(result.usage);
        setPaywallOpen(true);
        return;
      }
    }
    setOpen(newOpen);
  };

  const stage = defaultStage || 'researching';

  const onSubmit = async (data: ContactFormData) => {
    try {
      const result = await createContact.mutateAsync({
        name: data.name,
        firm: data.firm || null,
        group_name: data.group_name || null,
        position: data.position || null,
        email: data.email || null,
        phone: null,
        connection_type: data.connection_type as ConnectionType,
        relationship_strength: 1,
        stage,
        last_contacted_at: null,
        next_followup_at: null,
        notes_summary: data.notes_summary || null,
        prep_questions_json: null,
      });
      toast.success('Contact added successfully');
      setOpen(false);
      form.reset();
      if (onContactCreated && result) {
        onContactCreated({
          id: result.id,
          name: data.name,
          firm: data.firm || null,
          email: data.email || null,
          stage,
        });
      }
    } catch (error) {
      toast.error('Failed to add contact');
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Contact</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Smith" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Firm</FormLabel>
                    <FormControl>
                      <Input placeholder="Goldman Sachs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="group_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group</FormLabel>
                    <FormControl>
                      <Input placeholder="TMT" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <FormControl>
                      <Input placeholder="Associate" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@firm.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="connection_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Connection Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select connection type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CONNECTION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes_summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Initial notes about this contact..."
                      className="resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createContact.isPending}>
                {createContact.isPending ? 'Adding...' : 'Add Contact'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <PaywallModal
      open={paywallOpen}
      onOpenChange={setPaywallOpen}
      feature="contact"
      usage={paywallUsage}
    />
    </>
  );
}
