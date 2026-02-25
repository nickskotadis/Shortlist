-- ============================================================
-- Migration 001 — Plan tracking + generation metadata
-- Run this in the Supabase SQL Editor after schema.sql
-- ============================================================

-- ── profiles: add billing + usage columns ────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS generation_count int NOT NULL DEFAULT 0;

-- ── generations: make input_data nullable (replaced by input_snapshot) ──

ALTER TABLE generations
  ALTER COLUMN input_data DROP NOT NULL;

-- ── generations: add metadata columns ────────────────────────

ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS input_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS prompt_version text,
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS input_tokens int,
  ADD COLUMN IF NOT EXISTS output_tokens int,
  ADD COLUMN IF NOT EXISTS latency_ms int,
  ADD COLUMN IF NOT EXISTS user_type user_type,
  ADD COLUMN IF NOT EXISTS feedback_rating smallint
    CHECK (feedback_rating BETWEEN 1 AND 5);

-- ── indexes for analytics queries ────────────────────────────

CREATE INDEX IF NOT EXISTS generations_prompt_version_idx
  ON generations (prompt_version);

CREATE INDEX IF NOT EXISTS generations_user_type_idx
  ON generations (user_type);

CREATE INDEX IF NOT EXISTS generations_verdict_idx
  ON generations (validator_verdict);
