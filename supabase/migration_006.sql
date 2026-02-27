-- migration_006.sql — Job application tracker enhancements
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'applied'
    CHECK (status IN ('applied', 'interview', 'offer', 'rejected', 'withdrawn')),
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON public.job_applications(user_id, status);
