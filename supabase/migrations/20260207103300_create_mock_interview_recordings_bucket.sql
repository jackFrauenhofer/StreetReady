-- Create storage bucket for mock interview recordings (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('mock-interview-recordings', 'mock-interview-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Create policies for mock interview recordings uploads
DO $$ BEGIN
  CREATE POLICY "Users can upload their own mock interview recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'mock-interview-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view their own mock interview recordings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'mock-interview-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own mock interview recordings"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'mock-interview-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own mock interview recordings"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'mock-interview-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
