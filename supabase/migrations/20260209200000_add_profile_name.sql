-- Add name field to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
