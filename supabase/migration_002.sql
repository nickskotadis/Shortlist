-- Week 3: feedback_positive column + UPDATE RLS policy

ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS feedback_positive boolean;

CREATE POLICY "Users can update own generations"
  ON generations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
