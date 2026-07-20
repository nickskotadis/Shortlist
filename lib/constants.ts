export const MODELS = {
  generator: "claude-sonnet-4-6",
  parser: "claude-haiku-4-5-20251001",   // JD parsing — Haiku is sufficient and 6x cheaper
  validator: "claude-haiku-4-5-20251001",
} as const;

// Bump the version string whenever you edit the corresponding prompt template.
// Stored on every generations row so you can measure impact of prompt changes.
export const PROMPT_VERSIONS = {
  jd_parser: "jd-parser-v1",
  bullets: "bullets-v3",
  summary: "summary-v3",
  cover_letter: "cover-letter-v3",
  linkedin_about: "linkedin-about-v2",
  linkedin_headline: "linkedin-headline-v2",
  validator: "validator-v2",
  health_score: "health-score-v1",
  tailoring: "tailoring-v1",
  interview_prep: "interview-prep-v1",
  answer_coach: "answer-coach-v1",
  mock_interview: "mock-interview-v1",
  negotiation: "negotiation-v1",
  fit_score: "fit-score-v1",
} as const;

export const BANNED_PHRASES = [
  "results-driven",
  "results-oriented",
  "passionate about",
  "passionate professional",
  "team player",
  "proven track record",
  "self-starter",
  "detail-oriented",
  "hard-working",
  "hardworking",
  "go-getter",
  "synergy",
  "synergize",
  "leverage",
  "utilize",
  "dynamic professional",
  "innovative",
  "visionary",
  "thought leader",
  "best-in-class",
  "was responsible for",
  "helped with",
  "assisted in",
  "I am writing to apply",
  "I would be a great fit",
  "Please find my resume attached",
  "Thank you for your time and consideration",
  "To whom it may concern",
] as const;

export const FREE_MONTHLY_LIMIT = 2;
export const FREE_FIT_LIMIT = 1;

// ── Anonymous / unauthenticated IP rate limits ────────────────────────────────
// The authed free tier is capped per-month in the DB; these bound logged-out
// traffic per IP so anonymous access can't be scripted into unbounded LLM spend.
// /generate runs Sonnet (most expensive) but logged-out generation is a
// deliberate try-before-signup path — 5/hr/IP lets a genuine evaluator try
// several doc types while capping abuse. /interview is fully unauthenticated
// Haiku at 4096 output tokens — 10/hr/IP covers real use (one prep = 6–8 Qs).
export const ANON_GENERATE_LIMIT = 5;
export const ANON_GENERATE_WINDOW_SEC = 3600;
export const INTERVIEW_IP_LIMIT = 10;
export const INTERVIEW_IP_WINDOW_SEC = 3600;
// Resume parsing is cheap CPU (unpdf/mammoth), not an LLM call, and
// upload→first-generation is the core try-before-signup moment — so anonymous
// upload is allowed, bounded per IP against parser-DoS abuse.
export const PARSE_RESUME_IP_LIMIT = 10;
export const PARSE_RESUME_IP_WINDOW_SEC = 3600;

export const MAX_RETRIES = 1;
export const PASS_THRESHOLD = 7.0;
export const MIN_DIMENSION_SCORE = 6;

export const TONES = [
  {
    value: "professional",
    label: "Professional",
    description: "Polished, formal — standard for most industries",
  },
  {
    value: "conversational",
    label: "Conversational",
    description: "Warm, approachable — startups and creative roles",
  },
  {
    value: "bold",
    label: "Bold / Direct",
    description: "High-confidence, punchy — sales, leadership, exec",
  },
] as const;

// A/B test variant for prompt experimentation — set PROMPT_AB_VARIANT=B in env to activate variant B
export const PROMPT_AB_VARIANT: "A" | "B" =
  (process.env.PROMPT_AB_VARIANT as "A" | "B") === "B" ? "B" : "A";
