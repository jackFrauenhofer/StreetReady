import { useState, useMemo } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { toast } from 'sonner';
import { Plus, Trash2, Heart, ListTodo, Calendar, PhoneCall, Sparkles, Loader2, ChevronDown, ChevronRight, X, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTasks } from '@/hooks/useTasks';
import { useUpcomingCalls } from '@/hooks/useCallEvents';
import { useContacts } from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { PrepQuestion } from '@/lib/types';

export function TasksPage() {
  const { user } = useAuth();
  const { tasks, isLoading, createTask, toggleTaskComplete, deleteTask } = useTasks(user?.id);
  const { data: upcomingCalls = [] } = useUpcomingCalls(user?.id, 30);
  const { updateContact } = useContacts(user?.id);
  const navigate = useNavigate();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedCalls, setExpandedCalls] = useState<Record<string, boolean>>({});
  const [newQuestionText, setNewQuestionText] = useState<Record<string, string>>({});
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const toggleCallExpanded = (callId: string) => {
    setExpandedCalls((prev) => ({ ...prev, [callId]: !prev[callId] }));
  };

  const handleAddQuestion = async (contactId: string, questionsJson: unknown[] | null) => {
    const text = newQuestionText[contactId]?.trim();
    if (!text) return;
    const question: PrepQuestion = {
      id: crypto.randomUUID(),
      text,
      added_at: new Date().toISOString(),
    };
    const updated = [...((questionsJson as PrepQuestion[]) || []), question];
    try {
      await updateContact.mutateAsync({ id: contactId, prep_questions_json: updated as any });
      setNewQuestionText((prev) => ({ ...prev, [contactId]: '' }));
    } catch {
      toast.error('Failed to save question');
    }
  };

  const handleDeleteQuestion = async (contactId: string, questionId: string, questionsJson: unknown[] | null) => {
    const current = ((questionsJson as PrepQuestion[]) || []);
    const updated = current.filter((q) => q.id !== questionId);
    try {
      await updateContact.mutateAsync({ id: contactId, prep_questions_json: updated as any });
    } catch {
      toast.error('Failed to delete question');
    }
  };

  const handleGenerateQuestions = async (contactId: string, questionsJson: unknown[] | null) => {
    setGeneratingFor(contactId);
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
        body: JSON.stringify({ contactId }),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`Failed (${resp.status}): ${errBody}`);
      }

      const { questions } = await resp.json();
      if (!Array.isArray(questions) || questions.length === 0) {
        toast.error('No questions generated');
        return;
      }

      const newQuestions: PrepQuestion[] = questions.map((text: string) => ({
        id: crypto.randomUUID(),
        text,
        added_at: new Date().toISOString(),
      }));

      const current = ((questionsJson as PrepQuestion[]) || []);
      const updated = [...current, ...newQuestions];
      await updateContact.mutateAsync({ id: contactId, prep_questions_json: updated as any });
      toast.success(`${newQuestions.length} questions generated!`);
    } catch (error) {
      console.error('Generate questions error:', error);
      toast.error('Failed to generate questions');
    } finally {
      setGeneratingFor(null);
    }
  };

  // Separate tasks by type
  const { thankYouTasks, manualTasks } = useMemo(() => {
    const thankYou = tasks.filter((t) => t.task_type === 'thank_you');
    const manual = tasks.filter((t) => t.task_type !== 'thank_you');
    return { thankYouTasks: thankYou, manualTasks: manual };
  }, [tasks]);

  // Further separate by completion status
  const pendingThankYou = thankYouTasks.filter((t) => !t.completed);
  const completedThankYou = thankYouTasks.filter((t) => t.completed);
  const pendingManual = manualTasks.filter((t) => !t.completed);
  const completedManual = manualTasks.filter((t) => t.completed);

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    try {
      await createTask.mutateAsync({
        title: newTaskTitle.trim(),
        due_date: newTaskDueDate || null,
      });
      toast.success('Task created');
      setNewTaskTitle('');
      setNewTaskDueDate('');
      setDialogOpen(false);
    } catch {
      toast.error('Failed to create task');
    }
  };

  const handleToggleComplete = async (taskId: string, currentCompleted: boolean) => {
    try {
      await toggleTaskComplete.mutateAsync({ id: taskId, completed: !currentCompleted });
      toast.success(!currentCompleted ? 'Task completed!' : 'Task reopened');
    } catch {
      toast.error('Failed to update task');
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask.mutateAsync(taskId);
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground">
            {pendingThankYou.length + pendingManual.length} pending tasks
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="What needs to be done?"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date (optional)</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                />
              </div>
              <Button
                onClick={handleCreateTask}
                disabled={createTask.isPending}
                className="w-full"
              >
                {createTask.isPending ? 'Creating...' : 'Create Task'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Prepare for Calls Section */}
      {upcomingCalls.length > 0 && (
        <Card className="border-l-4 border-l-blue-500/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <PhoneCall className="h-5 w-5 text-blue-600" />
              Prepare for Calls
              <Badge variant="secondary" className="ml-2">
                {upcomingCalls.length} upcoming
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Review contacts and prepare questions before your calls
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingCalls.map((call) => {
              const isExpanded = expandedCalls[call.id];
              const questions = (call.contact?.prep_questions_json as PrepQuestion[]) || [];
              const contactId = call.contact?.id;

              return (
                <div key={call.id} className="rounded-lg border bg-card">
                  <button
                    type="button"
                    className="flex items-center gap-3 w-full p-3 text-left hover:bg-muted/50 transition-colors rounded-lg"
                    onClick={() => toggleCallExpanded(call.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {call.contact?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {call.contact?.firm && `${call.contact.firm} • `}
                        {format(new Date(call.start_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    {questions.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {questions.length} Q
                      </Badge>
                    )}
                  </button>

                  {isExpanded && contactId && (
                    <div className="px-3 pb-3 space-y-3 border-t pt-3">
                      {/* Prep Tips */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prep Checklist</p>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>• Review their LinkedIn profile</p>
                          <p>• Research {call.contact?.firm || 'the firm'}{call.contact?.group_name ? ` (${call.contact.group_name})` : ''}</p>
                          <p>• Prepare thoughtful questions below</p>
                        </div>
                      </div>

                      {/* Questions */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your Questions</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            disabled={generatingFor === contactId}
                            onClick={() => handleGenerateQuestions(contactId, call.contact?.prep_questions_json ?? null)}
                          >
                            {generatingFor === contactId ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3" />
                                AI Generate
                              </>
                            )}
                          </Button>
                        </div>

                        {questions.length > 0 && (
                          <div className="space-y-1.5">
                            {questions.map((q) => (
                              <div key={q.id} className="flex items-start gap-2 group">
                                <p className="text-sm text-foreground flex-1 leading-relaxed">• {q.text}</p>
                                <button
                                  type="button"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                                  onClick={() => handleDeleteQuestion(contactId, q.id, call.contact?.prep_questions_json ?? null)}
                                >
                                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Input
                            placeholder="Add a question..."
                            className="h-8 text-sm"
                            value={newQuestionText[contactId] || ''}
                            onChange={(e) => setNewQuestionText((prev) => ({ ...prev, [contactId]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddQuestion(contactId, call.contact?.prep_questions_json ?? null);
                              }
                            }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => handleAddQuestion(contactId, call.contact?.prep_questions_json ?? null)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* View Contact Link */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-muted-foreground"
                        onClick={() => navigate(`/contact/${contactId}`)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Contact
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Thank You Tasks Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Heart className="h-5 w-5 text-destructive" />
            Thank You Notes
            {pendingThankYou.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingThankYou.length} pending
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Auto-generated reminders to send thank you notes after calls
          </p>
        </CardHeader>
        <CardContent>
          {pendingThankYou.length === 0 && completedThankYou.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No thank you tasks yet. They'll appear here 12 hours after completing a call.
            </p>
          ) : (
            <div className="space-y-2">
              {pendingThankYou.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={handleToggleComplete}
                  onDelete={handleDelete}
                />
              ))}
              {completedThankYou.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">
                    Completed ({completedThankYou.length})
                  </p>
                  {completedThankYou.slice(0, 5).map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={handleToggleComplete}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Tasks Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListTodo className="h-5 w-5 text-primary" />
            My Tasks
            {pendingManual.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingManual.length} pending
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">Your personal to-do list</p>
        </CardHeader>
        <CardContent>
          {pendingManual.length === 0 && completedManual.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-4">
                No tasks yet. Create one to get started!
              </p>
              <Button variant="outline" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Task
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingManual.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={handleToggleComplete}
                  onDelete={handleDelete}
                />
              ))}
              {completedManual.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">
                    Completed ({completedManual.length})
                  </p>
                  {completedManual.slice(0, 5).map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={handleToggleComplete}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface TaskItemProps {
  task: {
    id: string;
    title: string;
    completed: boolean;
    due_date: string | null;
    contact?: { id: string; name: string; firm: string | null } | null;
  };
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
  const isDueToday = task.due_date && isToday(new Date(task.due_date));

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group',
        task.completed && 'opacity-60'
      )}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={() => onToggle(task.id, task.completed)}
        className="h-5 w-5"
      />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-medium truncate',
            task.completed && 'line-through text-muted-foreground'
          )}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.contact && (
            <span className="text-xs text-muted-foreground">
              {task.contact.name}
              {task.contact.firm && ` @ ${task.contact.firm}`}
            </span>
          )}
          {task.due_date && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs',
                isOverdue && !task.completed && 'text-destructive',
                isDueToday && !task.completed && 'text-warning',
                !isOverdue && !isDueToday && 'text-muted-foreground'
              )}
            >
              <Calendar className="h-3 w-3" />
              {format(new Date(task.due_date), 'MMM d')}
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(task.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
