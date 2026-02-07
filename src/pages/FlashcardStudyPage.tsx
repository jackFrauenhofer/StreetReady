import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Trophy, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { useFlashcardDeck, useStudySession, useUpdateFlashcardProgress } from '@/hooks/useFlashcards';
import { StudyCard } from '@/components/flashcards/StudyCard';
import type { FlashcardWithProgress } from '@/lib/flashcard-types';
import { toast } from 'sonner';
import { useSubscription, type UsageData } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/paywall/PaywallModal';

export function FlashcardStudyPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const { data: deckData, isLoading: deckLoading } = useFlashcardDeck(deckId, user?.id);
  const { data: dueCards, isLoading: cardsLoading, refetch } = useStudySession(deckId, user?.id);
  const updateProgress = useUpdateFlashcardProgress(user?.id);
  const { checkUsage } = useSubscription();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallUsage, setPaywallUsage] = useState<UsageData | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionCards, setSessionCards] = useState<FlashcardWithProgress[]>([]);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });

  // Initialize session cards when due cards load
  useMemo(() => {
    if (dueCards && !sessionStarted) {
      setSessionCards([...dueCards]);
    }
  }, [dueCards, sessionStarted]);

  const currentCard = sessionCards[currentIndex];

  const handleAnswer = async (correct: boolean) => {
    if (!user || !currentCard) {
      toast.error('Please log in to track your progress');
      return;
    }

    // Check usage limit before every card answer
    const result = await checkUsage('flashcard');
    if (!result.allowed) {
      setPaywallUsage(result.usage);
      setPaywallOpen(true);
      return;
    }

    // Map boolean to confidence: correct = 4 (Easy), incorrect = 1 (Again)
    const confidence = correct ? 4 : 1;

    try {
      await updateProgress.mutateAsync({
        flashcardId: currentCard.id,
        confidence,
      });

      setSessionStats(prev => ({
        reviewed: prev.reviewed + 1,
        correct: correct ? prev.correct + 1 : prev.correct,
      }));

      // If incorrect, add card back to end of queue
      if (!correct) {
        setSessionCards(prev => [...prev, currentCard]);
      }

      // Move to next card
      if (currentIndex + 1 < sessionCards.length) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setSessionComplete(true);
      }
    } catch (error) {
      toast.error('Failed to save progress');
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSessionComplete(false);
    setSessionStats({ reviewed: 0, correct: 0 });
    refetch();
  };

  const handleEndSession = () => {
    navigate(`/learning/flashcards/${deckId}`);
  };

  if (deckLoading || cardsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading cards...</div>
      </div>
    );
  }

  if (!deckData) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Deck not found</p>
        <Button variant="link" onClick={() => navigate('/learning')}>
          Back to Learning
        </Button>
      </div>
    );
  }

  const { deck } = deckData;
  const progress = sessionCards.length > 0 
    ? Math.round((currentIndex / sessionCards.length) * 100)
    : 0;

  // Session complete screen
  if (sessionComplete) {
    const accuracy = sessionStats.reviewed > 0 
      ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100)
      : 0;

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <Card className="text-center p-8">
          <CardContent className="space-y-6">
            <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-950 rounded-full flex items-center justify-center">
              <Trophy className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Session Complete!</h1>
              <p className="text-muted-foreground mt-2">
                Great job studying {deck.category}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-foreground">{sessionStats.reviewed}</p>
                <p className="text-sm text-muted-foreground">Cards Reviewed</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{accuracy}%</p>
                <p className="text-sm text-muted-foreground">Accuracy</p>
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={handleRestart}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Study Again
              </Button>
              <Button onClick={handleEndSession}>
                Back to Deck
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No cards to study
  if (sessionCards.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <Card className="text-center p-8">
          <CardContent className="space-y-6">
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Trophy className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">All Caught Up!</h1>
              <p className="text-muted-foreground mt-2">
                No cards due for review in {deck.category}. Check back later!
              </p>
            </div>
            <Button onClick={handleEndSession}>
              Back to Deck
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/learning/flashcards/${deckId}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{deck.category}</h1>
            <p className="text-sm text-muted-foreground">
              Card {currentIndex + 1} of {sessionCards.length}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleEndSession}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Progress bar */}
      <Progress value={progress} className="h-2" />

      {/* Current card */}
      {currentCard && (
        <StudyCard
          card={currentCard}
          onAnswer={handleAnswer}
          isSubmitting={updateProgress.isPending}
        />
      )}
    </div>

    <PaywallModal
      open={paywallOpen}
      onOpenChange={setPaywallOpen}
      feature="flashcard"
      usage={paywallUsage}
    />
    </>
  );
}
