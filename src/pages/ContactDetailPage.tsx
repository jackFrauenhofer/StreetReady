import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Building2, Mail, Phone, Sparkles, Trash2, Plus, X, Loader2, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useContact, useContacts } from '@/hooks/useContacts';
import { useInteractions } from '@/hooks/useInteractions';
import { useAuth } from '@/hooks/useAuth';
import { RelationshipStrength } from '@/components/contacts/RelationshipStrength';
import { StageBadge } from '@/components/contacts/StageBadge';
import { AddInteractionModal } from '@/components/contacts/AddInteractionModal';
import { EditContactModal } from '@/components/contacts/EditContactModal';
import { INTERACTION_TYPES, type PrepQuestion } from '@/lib/types';
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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: contact, isLoading: contactLoading } = useContact(id);
  const { deleteContact, updateContact } = useContacts(user?.id);
  const { interactions, isLoading: interactionsLoading } = useInteractions(id, user?.id);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [notesValue, setNotesValue] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const questions = (contact?.prep_questions_json as PrepQuestion[]) || [];

  const handleAddQuestion = async () => {
    if (!newQuestionText.trim() || !contact) return;
    const question: PrepQuestion = {
      id: crypto.randomUUID(),
      text: newQuestionText.trim(),
      added_at: new Date().toISOString(),
    };
    const updated = [...questions, question];
    try {
      await updateContact.mutateAsync({ id: contact.id, prep_questions_json: updated as any });
      setNewQuestionText('');
    } catch {
      toast.error('Failed to save question');
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!contact) return;
    const updated = questions.filter((q) => q.id !== questionId);
    try {
      await updateContact.mutateAsync({ id: contact.id, prep_questions_json: updated as any });
    } catch {
      toast.error('Failed to delete question');
    }
  };

  const handleGenerateQuestions = async () => {
    if (!contact) return;
    setGeneratingQuestions(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(`${supabaseUrl}/functions/v1/generate-call-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ contactId: contact.id }),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`Failed (${resp.status}): ${errBody}`);
      }

      const { questions: generated } = await resp.json();
      if (!Array.isArray(generated) || generated.length === 0) {
        toast.error('No questions generated');
        return;
      }

      const newQuestions: PrepQuestion[] = generated.map((text: string) => ({
        id: crypto.randomUUID(),
        text,
        added_at: new Date().toISOString(),
      }));

      const updated = [...questions, ...newQuestions];
      await updateContact.mutateAsync({ id: contact.id, prep_questions_json: updated as any });
      toast.success(`${newQuestions.length} questions generated!`);
    } catch (error) {
      console.error('Generate questions error:', error);
      toast.error('Failed to generate questions');
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!contact || notesValue === null) return;
    setSavingNotes(true);
    try {
      await updateContact.mutateAsync({ id: contact.id, notes_summary: notesValue || null });
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleGenerateEmail = async () => {
    if (!contact) return;
    setGeneratingEmail(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(`${supabaseUrl}/functions/v1/generate-outreach-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          contactId: contact.id,
          clientYear: new Date().getFullYear(),
          clientMonth: new Date().getMonth() + 1,
          clientDay: new Date().getDate(),
        }),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`Failed (${resp.status}): ${errBody}`);
      }

      const { subject, body } = await resp.json();
      setEmailSubject(subject || 'Networking Introduction');
      setEmailBody(body || '');
      setEmailDialogOpen(true);
    } catch (error) {
      console.error('Generate email error:', error);
      toast.error('Failed to generate email');
    } finally {
      setGeneratingEmail(false);
    }
  };

  const handleCopyEmail = () => {
    const fullText = `Subject: ${emailSubject}\n\n${emailBody}`;
    navigator.clipboard.writeText(fullText);
    toast.success('Email copied to clipboard');
  };

  const handleOpenInMail = () => {
    const mailto = `mailto:${contact?.email || ''}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailto, '_blank');
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteContact.mutateAsync(id);
      toast.success('Contact deleted');
      navigate('/pipeline');
    } catch (error) {
      toast.error('Failed to delete contact');
    }
  };

  if (contactLoading || !contact) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Button
        variant="ghost"
        className="gap-2"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{contact.name}</h1>
            <StageBadge stage={contact.stage} />
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            {contact.firm && (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                <span>
                  {contact.position && `${contact.position} @ `}
                  {contact.firm}
                  {contact.group_name && ` (${contact.group_name})`}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EditContactModal contact={contact} />
          <Button
            data-tour="generate-email-btn"
            variant="outline"
            size="sm"
            disabled={generatingEmail}
            onClick={handleGenerateEmail}
          >
            {generatingEmail ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Email
              </>
            )}
          </Button>
          <AddInteractionModal contactId={contact.id} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {contact.name}? This action cannot be undone.
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
      </div>

      {/* Quick Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground mb-1">Relationship</div>
            <RelationshipStrength strength={contact.relationship_strength} size="md" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground mb-1">Connection Type</div>
            <div className="font-medium capitalize">{contact.connection_type}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground mb-1">Last Contact</div>
            <div className="font-medium">
              {contact.last_contacted_at
                ? formatDistanceToNow(new Date(contact.last_contacted_at), { addSuffix: true })
                : 'Never'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground mb-1">Next Follow-up</div>
            <div className="font-medium">
              {contact.next_followup_at
                ? format(new Date(contact.next_followup_at), 'MMM d, yyyy')
                : 'Not scheduled'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact Info */}
      {(contact.email || contact.phone) && (
        <Card>
          <CardContent className="pt-4 flex gap-6">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <Mail className="h-4 w-4" />
                {contact.email}
              </a>
            )}
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <Phone className="h-4 w-4" />
                {contact.phone}
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="prep" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prep" data-tour="prep-tab">Questions & Notes</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          {interactionsLoading ? (
            <div className="animate-pulse text-muted-foreground">Loading interactions...</div>
          ) : interactions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground mb-4">No interactions yet</p>
                <AddInteractionModal contactId={contact.id} />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {interactions.map((interaction) => {
                const typeConfig = INTERACTION_TYPES.find((t) => t.value === interaction.type);
                return (
                  <Card key={interaction.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">
                          {typeConfig?.label || interaction.type}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(interaction.date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </CardHeader>
                    {interaction.notes && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {interaction.notes}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="prep" className="space-y-4">
          {/* Questions Section */}
          <Card data-tour="prep-questions-section">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">Prep Questions</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={generatingQuestions}
                  onClick={handleGenerateQuestions}
                >
                  {generatingQuestions ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      AI Generate
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {questions.length > 0 && (
                <div className="space-y-2">
                  {questions.map((q) => (
                    <div key={q.id} className="flex items-start gap-2 group p-2 rounded-lg hover:bg-muted/50">
                      <p className="text-sm text-foreground flex-1 leading-relaxed">• {q.text}</p>
                      <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 flex-shrink-0"
                        onClick={() => handleDeleteQuestion(q.id)}
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {questions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No questions yet. Add your own or use AI to generate personalized questions.
                </p>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Add a question..."
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddQuestion();
                  }}
                />
                <Button
                  variant="outline"
                  onClick={handleAddQuestion}
                  disabled={!newQuestionText.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Call Notes Section */}
          <Card data-tour="call-notes-section">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Call Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full min-h-[200px] p-3 rounded-lg border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Type your notes here during the call..."
                value={notesValue ?? contact.notes_summary ?? ''}
                onChange={(e) => setNotesValue(e.target.value)}
                onBlur={handleSaveNotes}
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Notes auto-save when you click away
                </p>
                {savingNotes && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Email Preview Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-2xl" data-tour="email-dialog">
          <DialogHeader>
            <DialogTitle>Generated Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Subject</label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Body</label>
              <textarea
                className="w-full min-h-[250px] p-3 rounded-lg border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyEmail}>
                <Copy className="h-3.5 w-3.5" />
                Copy to Clipboard
              </Button>
              <Button size="sm" className="gap-1.5" onClick={handleOpenInMail}>
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Mail
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
