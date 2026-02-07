-- ============================================================
-- FLASHCARD CSV IMPORT HELPER
-- ============================================================
--
-- Your CSV format:
--   track, category, topic, difficulty, question, answer, common_mistakes, source
--
-- The flashcards table needs: deck_id, question, answer, common_mistakes, difficulty
-- This script uses a temp table to stage the CSV, then resolves deck_id
-- by joining on (track, category). The "topic" and "source" columns are ignored.
--
-- HOW TO USE:
-- 1. Go to Supabase SQL Editor
-- 2. Paste this entire script
-- 3. Replace the example VALUES in the temp table insert with your CSV rows
--    (or use the CSV upload approach below)
-- 4. Run it
-- ============================================================

-- Step 1: Create a temporary staging table matching your CSV columns
CREATE TEMP TABLE IF NOT EXISTS flashcard_staging (
  track TEXT,
  category TEXT,
  topic TEXT,
  difficulty TEXT,
  question TEXT,
  answer TEXT,
  common_mistakes TEXT,
  source TEXT
);

-- Step 2: Clear any previous staging data
TRUNCATE flashcard_staging;

-- Step 3: Insert your CSV data into the staging table.
--
-- OPTION A: Paste rows as VALUES (replace the example below):
--
-- INSERT INTO flashcard_staging (track, category, topic, difficulty, question, answer, common_mistakes, source) VALUES
--   ('technicals', 'Accounting & Financial Statements - Core', 'Three Statements', 'core', 'Walk me through the three financial statements.', 'The three financial statements are...', 'Forgetting to mention...', 'BIWS'),
--   ('behaviorals', 'Story & Motivation - Why Investment Banking', 'Why IB', 'core', 'Why do you want to work in investment banking?', 'Structure: 1) Genuine interest...', 'Being too generic...', 'WSO');
--
-- OPTION B: Use Supabase Dashboard to CSV-import into flashcard_staging table,
--           then come back here and run Step 4 below.

-- Step 4: Insert into flashcards by resolving deck_id from (track, category)
INSERT INTO public.flashcards (deck_id, question, answer, common_mistakes, difficulty)
SELECT d.id, s.question, s.answer, NULLIF(s.common_mistakes, ''), s.difficulty
FROM flashcard_staging s
JOIN public.flashcard_decks d ON d.track::text = s.track AND d.category = s.category;

-- Step 5: Verify the import
SELECT d.track, d.category, COUNT(f.id) AS card_count
FROM public.flashcard_decks d
LEFT JOIN public.flashcards f ON f.deck_id = d.id
GROUP BY d.track, d.category
ORDER BY d.track, d.category;

-- Step 6: Clean up
DROP TABLE IF EXISTS flashcard_staging;
