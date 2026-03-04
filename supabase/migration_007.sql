-- migration_007.sql — Resume health score usage tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS score_count integer NOT NULL DEFAULT 0;
