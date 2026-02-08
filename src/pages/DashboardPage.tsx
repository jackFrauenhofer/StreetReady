import { useMemo } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Phone, PhoneCall, Target, CheckSquare, Users, BookOpen, Mic } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useContacts } from '@/hooks/useContacts';
import { useProfile } from '@/hooks/useProfile';
import { useUpcomingCalls, useCallEvents } from '@/hooks/useCallEvents';
import { useFlashcardMastery } from '@/hooks/useFlashcardMastery';
import { useTasks } from '@/hooks/useTasks';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';

import { MasteryCircle } from '@/components/dashboard/MasteryCircle';
import { ResumeUploader } from '@/components/dashboard/ResumeUploader';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function ProgressRing({ percentage, current, goal, label, icon: Icon }: {
  percentage: number;
  current: number;
  goal: number;
  label: string;
  icon: React.ElementType;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const isComplete = percentage >= 100;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            className="text-muted/30"
          />
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(
              'transition-all duration-700 ease-out',
              isComplete ? 'text-emerald-400' : 'text-green-500'
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn(
            'text-2xl font-bold',
            isComplete ? 'text-emerald-400' : 'text-green-500'
          )}>
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5 mb-0.5">
          <Icon className="h-3.5 w-3.5 text-green-400" />
          <span className="text-sm font-medium text-white">{label}</span>
        </div>
        <span className="text-xs text-white/60">
          {current} / {goal} this week
        </span>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { contacts, isLoading: contactsLoading } = useContacts(user?.id);
  const { profile, isLoading: profileLoading } = useProfile(user?.id);
  const { data: upcomingCalls = [], isLoading: callsLoading } = useUpcomingCalls(user?.id, 7);
  const { callEvents } = useCallEvents(user?.id);
  const { data: masteryData, isLoading: masteryLoading } = useFlashcardMastery(user?.id);
  const { tasks, toggleTaskComplete, isLoading: tasksLoading } = useTasks(user?.id);
  const navigate = useNavigate();

  // Fetch mock interview sessions for this week
  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const weekEnd = useMemo(() => endOfWeek(new Date(), { weekStartsOn: 1 }), []);

  const { data: weeklyMockInterviews = [] } = useQuery({
    queryKey: ['weeklyMockInterviews', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('mock_interview_sessions')
        .select('id')
        .eq('user_id', user.id)
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString());
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch interactions for this week
  const { data: weeklyInteractions = [] } = useQuery({
    queryKey: ['weeklyInteractions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', weekStart.toISOString())
        .lte('date', weekEnd.toISOString());
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const showOnboarding = profile && !profile.onboarding_completed;

  const completedCallsCount = useMemo(() => {
    return callEvents.filter((event) => event.status === 'completed').length;
  }, [callEvents]);

  // Calculate weekly activity progress
  const weeklyProgress = useMemo(() => {
    const interactionsGoal = profile?.weekly_interactions_goal || 10;
    const flashcardsGoal = profile?.weekly_flashcards_goal || 20;
    const mockInterviewsGoal = profile?.weekly_mock_interviews_goal || 3;
    const interactionsThisWeek = weeklyInteractions.length;
    const flashcardsThisWeek = masteryData?.studiedThisWeek || 0;
    const mockInterviewsThisWeek = weeklyMockInterviews.length;
    
    return {
      interactions: {
        current: interactionsThisWeek,
        goal: interactionsGoal,
        percentage: Math.min((interactionsThisWeek / interactionsGoal) * 100, 100),
      },
      flashcards: {
        current: flashcardsThisWeek,
        goal: flashcardsGoal,
        percentage: Math.min((flashcardsThisWeek / flashcardsGoal) * 100, 100),
      },
      mockInterviews: {
        current: mockInterviewsThisWeek,
        goal: mockInterviewsGoal,
        percentage: Math.min((mockInterviewsThisWeek / mockInterviewsGoal) * 100, 100),
      },
    };
  }, [weeklyInteractions, profile, masteryData, weeklyMockInterviews]);

  // Get pending tasks (sorted by due date, limited to 5)
  const pendingTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.completed)
      .slice(0, 5);
  }, [tasks]);

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    try {
      await toggleTaskComplete.mutateAsync({ id: taskId, completed: !completed });
      toast.success('Task completed!');
    } catch {
      toast.error('Failed to update task');
    }
  };

  if (profileLoading || contactsLoading || callsLoading || masteryLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <OnboardingModal open={!!showOnboarding} />

      {/* NYC Skyline Hero Banner */}
      <div data-tour="dashboard-hero" className="relative -mx-6 -mt-6 mb-8 overflow-hidden rounded-b-2xl">
        <div className="absolute inset-0 z-0">
          <img src="/or_nyc_skyline2.jpeg" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.3)_0%,rgba(0,0,0,0.6)_55%,rgba(0,0,0,0.8)_100%)]" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 z-[1] bg-gradient-to-t from-background to-transparent" />
        <div className="relative z-10 px-8 pt-10 pb-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">
              Welcome back{profile?.email ? `, ${profile.email.split('@')[0]}` : ''}
            </h1>
            <p className="text-white/60 mt-1">
              {format(new Date(), 'EEEE, MMMM d')}
            </p>
          </div>

          {/* Weekly Activity — 3 Circular Progress Rings */}
          <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            <ProgressRing
              percentage={weeklyProgress.interactions.percentage}
              current={weeklyProgress.interactions.current}
              goal={weeklyProgress.interactions.goal}
              label="Interactions"
              icon={Users}
            />
            <ProgressRing
              percentage={weeklyProgress.flashcards.percentage}
              current={weeklyProgress.flashcards.current}
              goal={weeklyProgress.flashcards.goal}
              label="Flashcards"
              icon={BookOpen}
            />
            <ProgressRing
              percentage={weeklyProgress.mockInterviews.percentage}
              current={weeklyProgress.mockInterviews.current}
              goal={weeklyProgress.mockInterviews.goal}
              label="Mock Interviews"
              icon={Mic}
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Mastery Progress */}
          <Card className="border-l-4 border-l-green-500/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-green-600" />
                Flashcard Mastery
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MasteryCircle 
                studiedCards={masteryData?.masteredCards || 0} 
                totalCards={masteryData?.totalCards || 0} 
              />
            </CardContent>
          </Card>

          {/* Upcoming Calls */}
          <Card className="border-l-4 border-l-blue-500/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Phone className="h-4 w-4 text-blue-600" />
                Upcoming Calls
                {upcomingCalls.length > 0 && (
                  <span className="ml-auto bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                    {upcomingCalls.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No upcoming calls
                </p>
              ) : (
                upcomingCalls.slice(0, 5).map((call) => (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-blue-50/50 cursor-pointer transition-colors"
                    onClick={() => navigate('/calendar')}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{call.contact?.name || 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground">
                        {call.contact?.firm || 'No firm'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(call.start_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Total Calls Had */}
          <Card className="border-l-4 border-l-[hsl(var(--accent))]/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-[hsl(var(--accent))]" />
                Total Calls Had
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-4">
                <div className="flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-[hsl(var(--accent))]/20 to-[hsl(var(--accent))]/5">
                  <span className="text-4xl font-bold text-[hsl(var(--accent))]">{completedCallsCount}</span>
                </div>
                <span className="text-sm text-muted-foreground mt-3">
                  {completedCallsCount === 1 ? 'call completed' : 'calls completed'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tasks To Do */}
        <Card className="border-l-4 border-l-amber-500/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-amber-600" />
                Tasks To Do
                {pendingTasks.length > 0 && (
                  <span className="ml-1 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                    {tasks.filter((t) => !t.completed).length}
                  </span>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pendingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No pending tasks
              </p>
            ) : (
              <div className="space-y-2">
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-amber-50/50 transition-colors"
                  >
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={() => handleToggleTask(task.id, task.completed)}
                      className="h-4 w-4"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm truncate',
                        task.completed && 'line-through text-muted-foreground'
                      )}>
                        {task.title}
                      </p>
                      {task.contact && (
                        <span className="text-xs text-muted-foreground">
                          {task.contact.name}
                        </span>
                      )}
                    </div>
                    {task.task_type === 'thank_you' && (
                      <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded font-medium">
                        Thank You
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resume Upload */}
        <ResumeUploader />
      </div>
    </div>
  );
}
