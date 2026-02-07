alter table public.user_resumes
  add column if not exists parsed_resume_json jsonb;
