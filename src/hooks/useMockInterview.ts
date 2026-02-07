import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { 
  MockInterviewSession, 
  MockInterviewQuestion, 
  MockInterviewAnswer,
  MockInterviewTrack,
  MockInterviewDifficulty,
  ScoreBreakdown,
} from '@/lib/mock-interview-types';

interface CreateSessionParams {
  track: MockInterviewTrack;
  categories: string[];
  difficulties: MockInterviewDifficulty[];
  session_length_minutes: number;
}

export function useMockInterview() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createSession = useMutation({
    mutationFn: async (params: CreateSessionParams) => {
      if (!user) throw new Error('Not authenticated');
      
      // Store categories and difficulties as comma-separated strings
      // The DB expects single values, so we join them
      const { data, error } = await supabase
        .from('mock_interview_sessions')
        .insert({
          user_id: user.id,
          track: params.track === 'both' ? 'technicals' : params.track, // DB expects technicals or behaviorals
          category: params.categories.join(','),
          difficulty: params.difficulties[0], // Primary difficulty for DB constraint
          session_length_minutes: params.session_length_minutes,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Return with full params for session use
      return {
        ...data,
        _categories: params.categories,
        _difficulties: params.difficulties,
        _track: params.track,
      } as MockInterviewSession & { _categories: string[]; _difficulties: MockInterviewDifficulty[]; _track: MockInterviewTrack };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mock-interview-sessions'] });
    },
  });

  const endSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase
        .from('mock_interview_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data as MockInterviewSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mock-interview-sessions'] });
    },
  });

  return {
    createSession,
    endSession,
  };
}

export function useMockInterviewSession(sessionId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ['mock-interview-session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await supabase
        .from('mock_interview_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      return data as MockInterviewSession;
    },
    enabled: !!sessionId && !!user,
  });

  const questionsQuery = useQuery({
    queryKey: ['mock-interview-questions', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from('mock_interview_questions')
        .select('*')
        .eq('session_id', sessionId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data as MockInterviewQuestion[];
    },
    enabled: !!sessionId && !!user,
  });

  const answersQuery = useQuery({
    queryKey: ['mock-interview-answers', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from('mock_interview_answers')
        .select('*')
        .eq('session_id', sessionId);

      if (error) throw error;
      return (data ?? []) as unknown as MockInterviewAnswer[];
    },
    enabled: !!sessionId && !!user,
  });

  const addQuestion = useMutation({
    mutationFn: async ({ questionText, orderIndex }: { questionText: string; orderIndex: number }) => {
      if (!sessionId) throw new Error('No session ID');
      
      const { data, error } = await supabase
        .from('mock_interview_questions')
        .insert({
          session_id: sessionId,
          question_text: questionText,
          order_index: orderIndex,
        })
        .select()
        .single();

      if (error) throw error;
      return data as MockInterviewQuestion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mock-interview-questions', sessionId] });
    },
  });

  const addAnswer = useMutation({
    mutationFn: async ({ 
      questionId, 
      recordingUrl,
      transcript,
      scoreOverall,
      scoreBreakdown,
      feedback,
      suggestedAnswer,
    }: { 
      questionId: string;
      recordingUrl?: string;
      transcript?: string;
      scoreOverall?: number;
      scoreBreakdown?: ScoreBreakdown;
      feedback?: string;
      suggestedAnswer?: string;
    }) => {
      if (!sessionId) throw new Error('No session ID');
      
      const insertData = {
        session_id: sessionId,
        question_id: questionId,
        recording_url: recordingUrl ?? null,
        transcript: transcript ?? null,
        score_overall: scoreOverall ?? null,
        score_breakdown_json: scoreBreakdown ? JSON.parse(JSON.stringify(scoreBreakdown)) : null,
        feedback: feedback ?? null,
        suggested_answer: suggestedAnswer ?? null,
      };
      
      const { data, error } = await supabase
        .from('mock_interview_answers')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return data as unknown as MockInterviewAnswer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mock-interview-answers', sessionId] });
    },
  });

  return {
    session: sessionQuery.data,
    questions: questionsQuery.data ?? [],
    answers: answersQuery.data ?? [],
    isLoading: sessionQuery.isLoading || questionsQuery.isLoading || answersQuery.isLoading,
    addQuestion,
    addAnswer,
  };
}

export function useMockInterviewSessions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['mock-interview-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mock_interview_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MockInterviewSession[];
    },
    enabled: !!user,
  });
}
