-- Add review_json column to user_resumes for storing AI resume review results
ALTER TABLE user_resumes
ADD COLUMN IF NOT EXISTS review_json jsonb DEFAULT NULL;
