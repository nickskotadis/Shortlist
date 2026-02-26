-- Week 5+ feature additions

-- ── Save master resume ─────────────────────────────────────────────────────────
-- Allows users to save their resume text and pre-fill the generate form
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS resume_text text;

-- ── Named generations (label) ──────────────────────────────────────────────────
-- Optional free-text label so users can identify "Stripe PM" vs "Google SWE"
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS label text;

-- ── Tone selector ──────────────────────────────────────────────────────────────
-- Stores the tone used for analytics; one of: professional, conversational, bold
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS tone text;
