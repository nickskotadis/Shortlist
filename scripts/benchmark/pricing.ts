// ── Model pricing ─────────────────────────────────────────────────────────────
// Input and output are priced separately, per model, in USD per million tokens.
//
// SOURCE: https://platform.claude.com/docs/en/docs/about-claude/pricing.md
// FETCHED: 2026-08-05 (live fetch succeeded; values below transcribed from the
//          "Model pricing" table on that page).
//
//   Claude Sonnet 4.6  — $3 / MTok input, $15 / MTok output
//   Claude Haiku 4.5   — $1 / MTok input,  $5 / MTok output
//
// These are the standard first-party Claude API rates. The benchmark does not
// use the Batch API (50% discount), prompt caching, fast mode, or a non-global
// inference_geo, so no pricing modifier applies.

export interface ModelPrice {
  /** USD per 1,000,000 input tokens */
  input: number;
  /** USD per 1,000,000 output tokens */
  output: number;
}

export const PRICING_SOURCE_URL =
  "https://platform.claude.com/docs/en/docs/about-claude/pricing.md";
export const PRICING_FETCHED_AT = "2026-08-05";

export const PRICING: Record<string, ModelPrice> = {
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  // The repo pins the dated Haiku alias; same rate card.
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0 },
};

/**
 * Cost in USD for a single call. Throws on an unpriced model rather than
 * silently returning 0 — a benchmark that under-reports spend is worse than
 * one that fails loudly.
 */
export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICING[model];
  if (!price) {
    throw new Error(
      `No pricing entry for model "${model}". Add it to scripts/benchmark/pricing.ts ` +
        `with a dated source comment before running.`
    );
  }
  return (inputTokens * price.input) / 1_000_000 + (outputTokens * price.output) / 1_000_000;
}

export function fmtUsd(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}
