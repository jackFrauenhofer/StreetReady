import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Zap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useMockInterview } from '@/hooks/useMockInterview';
import { useToast } from '@/hooks/use-toast';
import { useSubscription, type UsageData } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/paywall/PaywallModal';
import {
  MockInterviewTrack,
  MockInterviewDifficulty,
  ALL_DIFFICULTIES,
  TECHNICAL_CATEGORIES,
  BEHAVIORAL_CATEGORIES,
} from '@/lib/mock-interview-types';

export function SessionSetupForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createSession } = useMockInterview();
  const { checkUsage } = useSubscription();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallUsage, setPaywallUsage] = useState<UsageData | null>(null);
  
  const [sessionLength, setSessionLength] = useState<'15' | '30'>('15');
  const [track, setTrack] = useState<MockInterviewTrack>('technicals');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<MockInterviewDifficulty[]>(['core']);

  // Get categories based on track selection
  const availableCategories = track === 'technicals' 
    ? [...TECHNICAL_CATEGORIES]
    : track === 'behaviorals'
    ? [...BEHAVIORAL_CATEGORIES]
    : [...TECHNICAL_CATEGORIES, ...BEHAVIORAL_CATEGORIES];

  const allCategoriesSelected = selectedCategories.length === availableCategories.length;
  const allDifficultiesSelected = selectedDifficulties.length === ALL_DIFFICULTIES.length;

  // Reset categories when track changes
  const handleTrackChange = (newTrack: MockInterviewTrack) => {
    setTrack(newTrack);
    setSelectedCategories([]);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleAllCategories = () => {
    if (allCategoriesSelected) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories([...availableCategories]);
    }
  };

  const toggleDifficulty = (difficulty: MockInterviewDifficulty) => {
    setSelectedDifficulties(prev => 
      prev.includes(difficulty) 
        ? prev.filter(d => d !== difficulty)
        : [...prev, difficulty]
    );
  };

  const toggleAllDifficulties = () => {
    if (allDifficultiesSelected) {
      setSelectedDifficulties([]);
    } else {
      setSelectedDifficulties([...ALL_DIFFICULTIES]);
    }
  };

  const guardedStartSession = async (params: Parameters<typeof createSession.mutateAsync>[0]) => {
    // Check usage limit before creating session
    const result = await checkUsage('mock_interview');
    if (!result.allowed) {
      setPaywallUsage(result.usage);
      setPaywallOpen(true);
      return;
    }

    const session = await createSession.mutateAsync(params);
    navigate(`/mock-interview/session/${session.id}`);
  };

  const handleStartSession = async () => {
    if (selectedCategories.length === 0) {
      toast({
        title: 'Select at least one category',
        description: 'Please choose at least one category before starting.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedDifficulties.length === 0) {
      toast({
        title: 'Select at least one difficulty',
        description: 'Please choose at least one difficulty level before starting.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await guardedStartSession({
        track,
        categories: selectedCategories,
        difficulties: selectedDifficulties,
        session_length_minutes: parseInt(sessionLength),
      });
    } catch (error) {
      toast({
        title: 'Failed to start session',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleQuickStart = async () => {
    try {
      await guardedStartSession({
        track: 'both',
        categories: [...TECHNICAL_CATEGORIES, ...BEHAVIORAL_CATEGORIES],
        difficulties: ['core', 'common', 'advanced'],
        session_length_minutes: 15,
      });
    } catch (error) {
      toast({
        title: 'Failed to start session',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Configure Your Session</CardTitle>
        <CardDescription>
          Set up your mock interview parameters below
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Session Length */}
        <div className="space-y-3">
          <Label>Session Length</Label>
          <RadioGroup
            value={sessionLength}
            onValueChange={(value) => setSessionLength(value as '15' | '30')}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="15" id="length-15" />
              <Label htmlFor="length-15" className="cursor-pointer">15 minutes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="30" id="length-30" />
              <Label htmlFor="length-30" className="cursor-pointer">30 minutes</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Track Selector */}
        <div className="space-y-3">
          <Label>Track</Label>
          <div className="flex rounded-lg border border-input p-1 w-fit">
            <button
              type="button"
              onClick={() => handleTrackChange('technicals')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                track === 'technicals'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Technicals
            </button>
            <button
              type="button"
              onClick={() => handleTrackChange('behaviorals')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                track === 'behaviorals'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Behaviorals
            </button>
            <button
              type="button"
              onClick={() => handleTrackChange('both')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                track === 'both'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Both
            </button>
          </div>
        </div>

        {/* Category Multi-Select */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Categories</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleAllCategories}
              className="h-auto py-1 px-2 text-xs"
            >
              {allCategoriesSelected ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {availableCategories.map((category) => (
              <label
                key={category}
                className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                  selectedCategories.includes(category)
                    ? 'border-primary bg-primary/5'
                    : 'border-input hover:bg-muted/50'
                }`}
              >
                <Checkbox
                  checked={selectedCategories.includes(category)}
                  onCheckedChange={() => toggleCategory(category)}
                />
                <span className="text-sm">{category}</span>
              </label>
            ))}
          </div>
          {selectedCategories.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {selectedCategories.length} categor{selectedCategories.length === 1 ? 'y' : 'ies'} selected
            </p>
          )}
        </div>

        {/* Difficulty Multi-Select */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Difficulty</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleAllDifficulties}
              className="h-auto py-1 px-2 text-xs"
            >
              {allDifficultiesSelected ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <div className="flex gap-2">
            {ALL_DIFFICULTIES.map((difficulty) => (
              <label
                key={difficulty}
                className={`flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer transition-colors ${
                  selectedDifficulties.includes(difficulty)
                    ? 'border-primary bg-primary/5'
                    : 'border-input hover:bg-muted/50'
                }`}
              >
                <Checkbox
                  checked={selectedDifficulties.includes(difficulty)}
                  onCheckedChange={() => toggleDifficulty(difficulty)}
                />
                <span className="text-sm capitalize">{difficulty}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button 
            onClick={handleStartSession} 
            disabled={createSession.isPending}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            Start Session
          </Button>
          <Button 
            variant="secondary" 
            onClick={handleQuickStart}
            disabled={createSession.isPending}
            className="gap-2"
          >
            <Zap className="h-4 w-4" />
            Quick Start (All)
          </Button>
        </div>
      </CardContent>
    </Card>

    <PaywallModal
      open={paywallOpen}
      onOpenChange={setPaywallOpen}
      feature="mock_interview"
      usage={paywallUsage}
    />
    </>
  );
}
