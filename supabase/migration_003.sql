-- Week 3 cleanup + Week 4 prep

-- ── Drop unused feedback_rating column (replaced by feedback_positive boolean) ──
ALTER TABLE generations DROP COLUMN IF EXISTS feedback_rating;

-- ── Trigger: increment profiles.generation_count on every insert ──────────────
-- Required for Week 4 rate limiting — without this generation_count stays 0.

CREATE OR REPLACE FUNCTION increment_generation_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET generation_count = generation_count + 1
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_generation_created
  AFTER INSERT ON public.generations
  FOR EACH ROW EXECUTE FUNCTION increment_generation_count();
