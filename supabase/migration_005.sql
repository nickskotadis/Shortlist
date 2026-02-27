-- migration_005.sql — A/B test variant column on generations
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS ab_variant text;

-- Index for A/B analysis queries
CREATE INDEX IF NOT EXISTS idx_generations_ab_variant ON public.generations(ab_variant) WHERE ab_variant IS NOT NULL;
