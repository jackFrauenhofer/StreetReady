import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { InterviewTimer } from '@/components/mock-interview/InterviewTimer';
import { AIInterviewerPanel } from '@/components/mock-interview/AIInterviewerPanel';
import { AnswerRecorder } from '@/components/mock-interview/AnswerRecorder';
import { Scorecard } from '@/components/mock-interview/Scorecard';
import { useMockInterviewSession } from '@/hooks/useMockInterview';
import { useMockInterview } from '@/hooks/useMockInterview';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FALLBACK_QUESTIONS, type AnswerState, type ScoreBreakdown } from '@/lib/mock-interview-types';

export function MockInterviewSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { session, questions, answers, isLoading, addQuestion, addAnswer } = useMockInterviewSession(sessionId);
  const { endSession } = useMockInterview();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answerState, setAnswerState] = useState<AnswerState>('idle');
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(true);

  // Get current question from DB or generate new one
  const currentQuestion = questions[currentQuestionIndex];
  const answerForCurrentQuestion = currentQuestion
    ? (answers.find((a) => a.question_id === currentQuestion.id) ?? null)
    : null;

  // Generate first question when session loads
  useEffect(() => {
    if (session && questions.length === 0 && !addQuestion.isPending) {
      const categoryQuestions = FALLBACK_QUESTIONS[session.category] || [];
      const randomQuestion = categoryQuestions[Math.floor(Math.random() * categoryQuestions.length)] 
        || 'Tell me about yourself.';
      
      addQuestion.mutate({ questionText: randomQuestion, orderIndex: 0 });
    }
  }, [session, questions.length, addQuestion]);

  const handleAnswerComplete = useCallback(async (audio: Blob) => {
    if (!user) throw new Error('Not authenticated');
    if (!sessionId) throw new Error('No session');
    if (!currentQuestion) throw new Error('No question');

    // Basic guardrails
    const maxBytes = 25 * 1024 * 1024;
    if (audio.size > maxBytes) {
      throw new Error('Recording too large. Please record a shorter answer.');
    }

    const fileExt = audio.type.includes('webm') ? 'webm' : 'webm';
    const filePath = `${user.id}/${sessionId}/${currentQuestion.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase
      .storage
      .from('mock-interview-recordings')
      .upload(filePath, audio, {
        contentType: audio.type || 'audio/webm',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload failed:', uploadError);
      throw uploadError;
    }

    const createdAnswer = await addAnswer.mutateAsync({
      questionId: currentQuestion.id,
      recordingUrl: filePath,
    });

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw sessionError;
    }

    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error('Not authenticated (missing access token)');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const scoreResp = await fetch(
      `${supabaseUrl}/functions/v1/score-mock-interview`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ answerId: createdAnswer.id }),
      },
    );

    if (!scoreResp.ok) {
      const errBody = await scoreResp.text();
      console.error('Scoring failed:', scoreResp.status, errBody);
      throw new Error(`Scoring failed (${scoreResp.status})`);
    }

    // Edge function already updates the row; ensure UI refetches.
    await queryClient.invalidateQueries({ queryKey: ['mock-interview-answers', sessionId] });

    setAnswerState('scored');
  }, [user, sessionId, currentQuestion, addAnswer, queryClient]);

  const handleNextQuestion = useCallback(() => {
    if (!session) return;

    // Generate next question
    const categoryQuestions = FALLBACK_QUESTIONS[session.category] || [];
    const usedQuestions = questions.map(q => q.question_text);
    const availableQuestions = categoryQuestions.filter(q => !usedQuestions.includes(q));
    
    const nextQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)]
      || categoryQuestions[Math.floor(Math.random() * categoryQuestions.length)]
      || 'Tell me about a challenging situation you faced.';

    addQuestion.mutate({ 
      questionText: nextQuestion, 
      orderIndex: questions.length 
    });

    setCurrentQuestionIndex(prev => prev + 1);
    setAnswerState('idle');
  }, [session, questions, addQuestion]);

  const handleTimeUp = useCallback(() => {
    setIsSessionActive(false);
    handleEndSession();
  }, []);

  const handleEndSession = useCallback(async () => {
    if (sessionId) {
      await endSession.mutateAsync(sessionId);
      navigate(`/mock-interview/session/${sessionId}/summary`);
    }
  }, [sessionId, endSession, navigate]);

  if (isLoading || !session) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
        <div className="flex items-center gap-6">
          <InterviewTimer 
            durationMinutes={session.session_length_minutes} 
            onTimeUp={handleTimeUp}
            isRunning={isSessionActive}
          />
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Q{currentQuestionIndex + 1}</span>
            {' '}• {session.category}
          </div>
        </div>
        <Button 
          variant="destructive" 
          size="sm" 
          onClick={() => setShowEndConfirm(true)}
          className="gap-2"
        >
          <XCircle className="h-4 w-4" />
          End Session
        </Button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: AI Interviewer */}
        <div className="space-y-6">
          {currentQuestion ? (
            <AIInterviewerPanel 
              question={currentQuestion.question_text}
              questionNumber={currentQuestionIndex + 1}
            />
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center">
                  <div className="animate-pulse text-muted-foreground">Loading question...</div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Your Answer */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Answer</CardTitle>
            </CardHeader>
            <CardContent>
              {answerState !== 'scored' ? (
                <AnswerRecorder
                  onComplete={handleAnswerComplete}
                  answerState={answerState}
                  onStateChange={setAnswerState}
                />
              ) : (
                answerForCurrentQuestion &&
                answerForCurrentQuestion.score_overall !== null &&
                answerForCurrentQuestion.score_breakdown_json !== null &&
                answerForCurrentQuestion.feedback !== null &&
                answerForCurrentQuestion.suggested_answer !== null ? (
                  <Scorecard
                    overallScore={answerForCurrentQuestion.score_overall}
                    breakdown={answerForCurrentQuestion.score_breakdown_json as unknown as ScoreBreakdown}
                    feedback={answerForCurrentQuestion.feedback}
                    suggestedAnswer={answerForCurrentQuestion.suggested_answer}
                    onNextQuestion={handleNextQuestion}
                  />
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    Scoring your answer...
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* End Session Confirmation */}
      <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to end this mock interview session? 
              You've answered {questions.length} question{questions.length !== 1 ? 's' : ''} so far.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Session</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndSession}>
              End Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
