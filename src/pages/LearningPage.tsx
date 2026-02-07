import { useState, useMemo } from 'react';
import { Search, GraduationCap, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { FlashcardDeckCard } from '@/components/flashcards/FlashcardDeckCard';
import { useAuth } from '@/hooks/useAuth';
import { useFlashcardDecks, useTrackProgress } from '@/hooks/useFlashcards';

export function LearningPage() {
  const { user } = useAuth();
  const [activeTrack, setActiveTrack] = useState('technicals');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: techFlashcardDecks, isLoading: techLoading } = useFlashcardDecks('technicals', user?.id);
  const { data: behavFlashcardDecks, isLoading: behavLoading } = useFlashcardDecks('behaviorals', user?.id);
  const { data: techProgress } = useTrackProgress('technicals', user?.id);
  const { data: behavProgress } = useTrackProgress('behaviorals', user?.id);

  const activeDecks = activeTrack === 'technicals' ? techFlashcardDecks : behavFlashcardDecks;
  const isLoading = activeTrack === 'technicals' ? techLoading : behavLoading;
  const activeProgress = activeTrack === 'technicals' ? techProgress : behavProgress;

  const filteredDecks = useMemo(() => {
    if (!activeDecks) return [];
    if (!searchQuery) return activeDecks;

    return activeDecks.filter((deck) =>
      deck.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeDecks, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="h-6 w-6" />
          Learning
        </h1>
        <p className="text-muted-foreground">
          Master IB recruiting with flashcards
        </p>
      </div>

      {/* Track Tabs & Search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs value={activeTrack} onValueChange={setActiveTrack}>
          <TabsList>
            <TabsTrigger value="technicals" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Technicals
              {techProgress && (
                <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded">
                  {techProgress.percentage}%
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="behaviorals" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Behaviorals
              {behavProgress && (
                <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded">
                  {behavProgress.percentage}%
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search decks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Progress */}
      {activeProgress && activeProgress.total > 0 && (
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">
              {activeTrack === 'technicals' ? 'Technicals' : 'Behaviorals'} Progress
            </span>
            <span className="text-sm text-muted-foreground">
              {activeProgress.mastered} of {activeProgress.total} cards mastered
            </span>
          </div>
          <Progress value={activeProgress.percentage} className="h-2" />
        </div>
      )}

      {/* Content Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">
            Loading flashcard decks...
          </div>
        </div>
      ) : (
        // Flashcard Decks Grid
        filteredDecks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery ? 'No matching decks found' : 'No flashcard decks available yet'}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredDecks.map((deck) => (
              <FlashcardDeckCard key={deck.id} deck={deck} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
