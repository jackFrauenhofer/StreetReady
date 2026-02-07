-- Add CSV-friendly columns to flashcards table so you can import directly
-- CSV format: track, category, topic, difficulty, question, answer, common_mistakes, source

-- Add new columns
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS track TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Make deck_id nullable (will be auto-resolved by trigger)
ALTER TABLE public.flashcards ALTER COLUMN deck_id DROP NOT NULL;

-- Drop the old unique constraint on (deck_id, question) since deck_id may be null on insert
ALTER TABLE public.flashcards DROP CONSTRAINT IF EXISTS flashcards_deck_id_question_key;

-- Add a new unique constraint on (category, question) to prevent duplicates
ALTER TABLE public.flashcards ADD CONSTRAINT flashcards_category_question_key UNIQUE (category, question);

-- Create trigger function to auto-resolve deck_id from (track, category)
CREATE OR REPLACE FUNCTION public.resolve_flashcard_deck_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only resolve if deck_id is not already set
  IF NEW.deck_id IS NULL AND NEW.track IS NOT NULL AND NEW.category IS NOT NULL THEN
    SELECT id INTO NEW.deck_id
    FROM public.flashcard_decks
    WHERE flashcard_decks.track::text = NEW.track
      AND flashcard_decks.category = NEW.category
    LIMIT 1;

    IF NEW.deck_id IS NULL THEN
      RAISE EXCEPTION 'No flashcard_deck found for track=% category=%', NEW.track, NEW.category;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
DROP TRIGGER IF EXISTS resolve_flashcard_deck_id_trigger ON public.flashcards;
CREATE TRIGGER resolve_flashcard_deck_id_trigger
  BEFORE INSERT ON public.flashcards
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_flashcard_deck_id();
