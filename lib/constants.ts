export const MODELS = {
  generator: "claude-sonnet-4-6",
  validator: "claude-haiku-4-5-20251001",
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

export const MAX_RETRIES = 1;
export const PASS_THRESHOLD = 7.0;
export const MIN_DIMENSION_SCORE = 6;
