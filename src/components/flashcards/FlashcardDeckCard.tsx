import { useNavigate } from 'react-router-dom';
import { Layers, Target, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DeckWithStats } from '@/lib/flashcard-types';

interface FlashcardDeckCardProps {
  deck: DeckWithStats;
}

export function FlashcardDeckCard({ deck }: FlashcardDeckCardProps) {
  const navigate = useNavigate();

  return (
    <Card 
      className="hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all duration-200 cursor-pointer group"
      onClick={() => navigate(`/learning/flashcards/${deck.id}`)}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors">
          {deck.category}
        </CardTitle>
        {deck.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {deck.description}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Mastery</span>
            <span className="font-medium">{deck.masteryPercentage}%</span>
          </div>
          <Progress value={deck.masteryPercentage} className="h-2" />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Layers className="h-4 w-4" />
            <span>{deck.totalCards} cards</span>
          </div>
          <div className="flex items-center gap-1">
            <Target className="h-4 w-4" />
            <span>{deck.studiedCards} studied</span>
          </div>
        </div>

        {/* Strengths/Weaknesses */}
        {(deck.strongestTopics.length > 0 || deck.weakestTopics.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {deck.strongestTopics.map(topic => (
              <Badge key={topic} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                <TrendingUp className="h-3 w-3 mr-1" />
                {topic}
              </Badge>
            ))}
            {deck.weakestTopics.map(topic => (
              <Badge key={topic} variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                <TrendingDown className="h-3 w-3 mr-1" />
                {topic}
              </Badge>
            ))}
          </div>
        )}

        {/* CTA */}
        <Button 
          className="w-full" 
          variant={deck.dueToday > 0 ? "default" : "outline"}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/learning/flashcards/${deck.id}/study`);
          }}
        >
          <Clock className="h-4 w-4 mr-2" />
          {deck.dueToday > 0 ? `Study ${deck.dueToday} Cards` : 'Start Practice'}
        </Button>
      </CardContent>
    </Card>
  );
}
