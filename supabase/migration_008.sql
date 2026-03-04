-- migration_008.sql
-- Add usage tracking columns for Job Fit Scorer and Salary Negotiation Coach

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fit_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS negotiation_count int NOT NULL DEFAULT 0;
