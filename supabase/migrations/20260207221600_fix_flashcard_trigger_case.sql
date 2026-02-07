-- Fix trigger to handle case-insensitive track matching (e.g. "Technicals" → "technicals")
CREATE OR REPLACE FUNCTION public.resolve_flashcard_deck_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only resolve if deck_id is not already set
  IF NEW.deck_id IS NULL AND NEW.track IS NOT NULL AND NEW.category IS NOT NULL THEN
    SELECT id INTO NEW.deck_id
    FROM public.flashcard_decks
    WHERE flashcard_decks.track::text = LOWER(NEW.track)
      AND flashcard_decks.category = NEW.category
    LIMIT 1;

    IF NEW.deck_id IS NULL THEN
      RAISE EXCEPTION 'No flashcard_deck found for track=% category=%', NEW.track, NEW.category;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
