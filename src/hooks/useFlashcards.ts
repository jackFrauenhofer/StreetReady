import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  FlashcardDeck,
  Flashcard,
  UserFlashcardProgress,
  FlashcardTrack,
  DeckWithStats,
  FlashcardWithProgress,
  ConfidenceLevel,
} from '@/lib/flashcard-types';

// Fetch all decks for a track with stats
export function useFlashcardDecks(track: FlashcardTrack, userId: string | undefined) {
  return useQuery({
    queryKey: ['flashcardDecks', track, userId],
    queryFn: async () => {
      // Get decks for this track
      const { data: decks, error: decksError } = await supabase
        .from('flashcard_decks')
        .select('*')
        .eq('track', track)
        .order('category');
      
      if (decksError) throw decksError;
      if (!decks?.length) return [];

      // Get all flashcards for these decks
      const deckIds = decks.map(d => d.id);
      const { data: flashcards, error: flashcardsError } = await supabase
        .from('flashcards')
        .select('id, deck_id, difficulty')
        .in('deck_id', deckIds);
      
      if (flashcardsError) throw flashcardsError;

      // Get user progress if logged in
      let progressMap: Record<string, UserFlashcardProgress> = {};
      if (userId && flashcards?.length) {
        const flashcardIds = flashcards.map(f => f.id);
        const { data: progress } = await supabase
          .from('user_flashcard_progress')
          .select('*')
          .eq('user_id', userId)
          .in('flashcard_id', flashcardIds);
        
        if (progress) {
          progressMap = progress.reduce((acc, p) => {
            acc[p.flashcard_id] = p as UserFlashcardProgress;
            return acc;
          }, {} as Record<string, UserFlashcardProgress>);
        }
      }

      // Calculate stats for each deck
      const now = new Date();
      const decksWithStats: DeckWithStats[] = decks.map(deck => {
        const deckFlashcards = flashcards?.filter(f => f.deck_id === deck.id) || [];
        const totalCards = deckFlashcards.length;
        
        let studiedCards = 0;
        let masteredCards = 0;
        let dueToday = 0;
        const difficultyStats: Record<string, { studied: number; total: number; avgConfidence: number }> = {};

        deckFlashcards.forEach(card => {
          const progress = progressMap[card.id];
          const difficulty = card.difficulty;
          
          if (!difficultyStats[difficulty]) {
            difficultyStats[difficulty] = { studied: 0, total: 0, avgConfidence: 0 };
          }
          difficultyStats[difficulty].total++;

          if (progress) {
            studiedCards++;
            difficultyStats[difficulty].studied++;
            difficultyStats[difficulty].avgConfidence += progress.confidence || 0;
            
            if (progress.confidence && progress.confidence >= 4) {
              masteredCards++;
            }
            
            // Check if due today
            if (!progress.next_review_at || new Date(progress.next_review_at) <= now) {
              dueToday++;
            }
          } else {
            dueToday++; // Never studied = due
          }
        });

        // Calculate strongest/weakest topics by difficulty
        const sortedDifficulties = Object.entries(difficultyStats)
          .map(([diff, stats]) => ({
            difficulty: diff,
            avgConfidence: stats.studied > 0 ? stats.avgConfidence / stats.studied : 0,
            studied: stats.studied,
            total: stats.total,
          }))
          .sort((a, b) => b.avgConfidence - a.avgConfidence);

        const strongestTopics = sortedDifficulties
          .filter(d => d.avgConfidence >= 3.5)
          .slice(0, 2)
          .map(d => d.difficulty);
        
        const weakestTopics = sortedDifficulties
          .filter(d => d.studied > 0 && d.avgConfidence < 3)
          .slice(-2)
          .map(d => d.difficulty);

        return {
          ...deck,
          track: deck.track as FlashcardTrack,
          totalCards,
          studiedCards,
          masteryPercentage: totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0,
          dueToday,
          strongestTopics,
          weakestTopics,
        } as DeckWithStats;
      });

      return decksWithStats;
    },
    enabled: !!track,
  });
}

// Fetch a single deck with all flashcards
export function useFlashcardDeck(deckId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['flashcardDeck', deckId, userId],
    queryFn: async () => {
      if (!deckId) return null;

      // Get deck
      const { data: deck, error: deckError } = await supabase
        .from('flashcard_decks')
        .select('*')
        .eq('id', deckId)
        .maybeSingle();
      
      if (deckError) throw deckError;
      if (!deck) return null;

      // Get flashcards
      const { data: flashcards, error: flashcardsError } = await supabase
        .from('flashcards')
        .select('*')
        .eq('deck_id', deckId)
        .order('difficulty', { ascending: true });
      
      if (flashcardsError) throw flashcardsError;

      // Get user progress
      let progressMap: Record<string, UserFlashcardProgress> = {};
      if (userId && flashcards?.length) {
        const flashcardIds = flashcards.map(f => f.id);
        const { data: progress } = await supabase
          .from('user_flashcard_progress')
          .select('*')
          .eq('user_id', userId)
          .in('flashcard_id', flashcardIds);
        
        if (progress) {
          progressMap = progress.reduce((acc, p) => {
            acc[p.flashcard_id] = p as UserFlashcardProgress;
            return acc;
          }, {} as Record<string, UserFlashcardProgress>);
        }
      }

      const flashcardsWithProgress: FlashcardWithProgress[] = flashcards?.map(card => ({
        ...card,
        difficulty: card.difficulty as 'core' | 'common' | 'advanced',
        progress: progressMap[card.id],
      })) || [];

      return {
        deck: { ...deck, track: deck.track as FlashcardTrack } as FlashcardDeck,
        flashcards: flashcardsWithProgress,
      };
    },
    enabled: !!deckId,
  });
}

// Get due cards for a study session
export function useStudySession(deckId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['studySession', deckId, userId],
    queryFn: async () => {
      if (!deckId) return [];

      // Get all flashcards in deck
      const { data: flashcards, error: flashcardsError } = await supabase
        .from('flashcards')
        .select('*')
        .eq('deck_id', deckId);
      
      if (flashcardsError) throw flashcardsError;
      if (!flashcards?.length) return [];

      // Get user progress
      let progressMap: Record<string, UserFlashcardProgress> = {};
      if (userId) {
        const flashcardIds = flashcards.map(f => f.id);
        const { data: progress } = await supabase
          .from('user_flashcard_progress')
          .select('*')
          .eq('user_id', userId)
          .in('flashcard_id', flashcardIds);
        
        if (progress) {
          progressMap = progress.reduce((acc, p) => {
            acc[p.flashcard_id] = p as UserFlashcardProgress;
            return acc;
          }, {} as Record<string, UserFlashcardProgress>);
        }
      }

      const now = new Date();
      
      // Filter to due cards and sort by priority
      const dueCards = flashcards
        .map(card => ({
          ...card,
          difficulty: card.difficulty as 'core' | 'common' | 'advanced',
          progress: progressMap[card.id],
        }))
        .filter(card => {
          if (!card.progress) return true; // Never studied
          if (!card.progress.next_review_at) return true;
          return new Date(card.progress.next_review_at) <= now;
        })
        .sort((a, b) => {
          // Priority: never studied > low confidence > due
          if (!a.progress && b.progress) return -1;
          if (a.progress && !b.progress) return 1;
          if (!a.progress && !b.progress) return 0;
          
          const confA = a.progress?.confidence || 0;
          const confB = b.progress?.confidence || 0;
          return confA - confB; // Lower confidence first
        });

      return dueCards as FlashcardWithProgress[];
    },
    enabled: !!deckId,
  });
}

// Update flashcard progress
export function useUpdateFlashcardProgress(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      flashcardId,
      confidence,
    }: {
      flashcardId: string;
      confidence: ConfidenceLevel;
    }) => {
      if (!userId) throw new Error('Not authenticated');

      // Calculate next review time based on spaced repetition
      const now = new Date();
      let nextReviewHours: number;
      
      switch (confidence) {
        case 1: // Again - review in 10 minutes
          nextReviewHours = 1/6;
          break;
        case 2: // Hard - review in 1 hour
          nextReviewHours = 1;
          break;
        case 3: // Good - review in 1 day
          nextReviewHours = 24;
          break;
        case 4: // Easy - review in 3 days
          nextReviewHours = 72;
          break;
        case 5: // Perfect - review in 7 days
          nextReviewHours = 168;
          break;
        default:
          nextReviewHours = 24;
      }

      const nextReviewAt = new Date(now.getTime() + nextReviewHours * 60 * 60 * 1000);
      const isCorrect = confidence >= 3;

      // First check if progress exists
      const { data: existing } = await supabase
        .from('user_flashcard_progress')
        .select('id, times_seen, times_correct')
        .eq('user_id', userId)
        .eq('flashcard_id', flashcardId)
        .maybeSingle();

      if (existing) {
        // Update existing progress
        const { data, error } = await supabase
          .from('user_flashcard_progress')
          .update({
            confidence,
            last_reviewed_at: now.toISOString(),
            next_review_at: nextReviewAt.toISOString(),
            times_seen: existing.times_seen + 1,
            times_correct: isCorrect ? existing.times_correct + 1 : existing.times_correct,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new progress
        const { data, error } = await supabase
          .from('user_flashcard_progress')
          .insert({
            user_id: userId,
            flashcard_id: flashcardId,
            confidence,
            last_reviewed_at: now.toISOString(),
            next_review_at: nextReviewAt.toISOString(),
            times_seen: 1,
            times_correct: isCorrect ? 1 : 0,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcardDecks'] });
      queryClient.invalidateQueries({ queryKey: ['flashcardDeck'] });
      // Don't invalidate studySession here — the session is managed
      // locally in FlashcardStudyPage state. Invalidating mid-session
      // causes a refetch that overwrites the local card queue.
    },
  });
}

// Reset all progress for a deck
export function useResetDeckProgress(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deckId: string) => {
      if (!userId) throw new Error('Not authenticated');

      // Get all flashcard IDs in the deck
      const { data: flashcards, error: flashcardsError } = await supabase
        .from('flashcards')
        .select('id')
        .eq('deck_id', deckId);

      if (flashcardsError) throw flashcardsError;
      if (!flashcards?.length) return;

      const flashcardIds = flashcards.map(f => f.id);

      // Delete all progress for these flashcards
      const { error } = await supabase
        .from('user_flashcard_progress')
        .delete()
        .eq('user_id', userId)
        .in('flashcard_id', flashcardIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcardDecks'] });
      queryClient.invalidateQueries({ queryKey: ['flashcardDeck'] });
      queryClient.invalidateQueries({ queryKey: ['studySession'] });
      queryClient.invalidateQueries({ queryKey: ['flashcardMastery'] });
    },
  });
}

// Get overall track progress
export function useTrackProgress(track: FlashcardTrack, userId: string | undefined) {
  return useQuery({
    queryKey: ['flashcardTrackProgress', track, userId],
    queryFn: async () => {
      // Get all decks for track
      const { data: decks } = await supabase
        .from('flashcard_decks')
        .select('id')
        .eq('track', track);
      
      if (!decks?.length) return { total: 0, studied: 0, mastered: 0, percentage: 0 };

      const deckIds = decks.map(d => d.id);
      
      // Get all flashcards
      const { data: flashcards } = await supabase
        .from('flashcards')
        .select('id')
        .in('deck_id', deckIds);
      
      if (!flashcards?.length) return { total: 0, studied: 0, mastered: 0, percentage: 0 };

      const total = flashcards.length;

      if (!userId) return { total, studied: 0, mastered: 0, percentage: 0 };

      // Get progress
      const { data: progress } = await supabase
        .from('user_flashcard_progress')
        .select('confidence')
        .eq('user_id', userId)
        .in('flashcard_id', flashcards.map(f => f.id));

      const studied = progress?.length || 0;
      const mastered = progress?.filter(p => (p.confidence || 0) >= 4).length || 0;
      const percentage = total > 0 ? Math.round((mastered / total) * 100) : 0;

      return { total, studied, mastered, percentage };
    },
    enabled: !!track,
  });
}
