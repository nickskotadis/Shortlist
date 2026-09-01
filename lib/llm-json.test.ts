import { describe, it, expect, vi } from "vitest";

import { parseJson, parseLlmJson } from "@/lib/llm-json";
import { MAX_TOKENS } from "@/lib/pipeline";

// A realistic parser payload, matching the JdAnalysis shape the JD parser emits.
const COMPLETE_ANALYSIS = {
  role_title: "Senior Backend Engineer",
  seniority_level: "senior",
  must_haves: ["Node.js", "PostgreSQL"],
  key_terminology: ["distributed systems", "row-level security"],
  hiring_manager_worry: "Can this person own a service end to end?",
};
const COMPLETE_JSON = JSON.stringify(COMPLETE_ANALYSIS);

describe("token budget (MAX_TOKENS)", () => {
  // Past defect: the parser cap was 1024, below the measured 1,291–1,506 tokens
  // a near-limit-length JD requires. 46% of generations ran on a silently
  // truncated (discarded) analysis. 2048 is the minimum floor that clears the
  // measured worst case with headroom; the shipped fix is 4096.
  it("parser cap stays at or above the floor needed for long postings", () => {
    expect(MAX_TOKENS.parser).toBeGreaterThanOrEqual(2048);
  });

  // Same defect class in the validator: at 1024 it truncated its own JSON on
  // 5.1% of benchmark calls, wasting the retry and ending generations ungraded.
  it("validator cap stays at or above the floor needed for issue-heavy outputs", () => {
    expect(MAX_TOKENS.validator).toBeGreaterThanOrEqual(2048);
  });
});

describe("parseJson — truncation detection", () => {
  it("flags a response cut off mid-object (max_tokens hit) as truncated, not success", () => {
    // Exactly what a stop_reason:"max_tokens" response body looks like: the
    // model stops mid-token, so the JSON never balances.
    const truncated = COMPLETE_JSON.slice(0, Math.floor(COMPLETE_JSON.length / 2));
    const result = parseJson(truncated);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("truncated");
  });

  it("flags a response cut off mid-array as truncated", () => {
    const result = parseJson('["Improve the summary", "Add metrics to bullet 2", "Quantify');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("truncated");
  });

  it("flags truncation even when the cut-off output ends in a code fence", () => {
    const result = parseJson('```json\n{"role_title": "Engineer", "must_haves": ["Nod\n```');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("truncated");
  });

  it("does not flag a complete response as truncated", () => {
    const result = parseJson<typeof COMPLETE_ANALYSIS>(COMPLETE_JSON);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(COMPLETE_ANALYSIS);
  });

  it("does not flag a complete response wrapped in fences and prose as truncated", () => {
    const noisy = `Here is the analysis you asked for:\n\n\`\`\`json\n${COMPLETE_JSON}\n\`\`\`\nLet me know if you need anything else.`;
    const result = parseJson<typeof COMPLETE_ANALYSIS>(noisy);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(COMPLETE_ANALYSIS);
  });

  // Regression for the mislabelling fix: JSON that FINISHED but is structurally
  // broken must be reported as "invalid", not "truncated" — "truncated" sends
  // an investigator toward raising a token cap that was never the problem.
  it("labels finished-but-malformed JSON as invalid, not truncated", () => {
    const result = parseJson('{"must_haves": ["Node.js", "SQL"}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid");
  });
});

describe("parseJson — fail-closed on bad input", () => {
  it("rejects an empty response with an explicit error", () => {
    const result = parseJson("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("empty");
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it("rejects a whitespace-only response", () => {
    const result = parseJson("   \n\t  ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty");
  });

  it("rejects prose containing no JSON at all", () => {
    const result = parseJson("I'm sorry, I can't produce that analysis.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid");
  });

  it("rejects balanced-but-unparseable JSON", () => {
    const result = parseJson('{"quote": "she said "hello" to the room"}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid");
  });
});

describe("parseLlmJson — retry semantics", () => {
  it("returns the first result without a second call when parsing succeeds", async () => {
    const runLlm = vi.fn().mockResolvedValue(COMPLETE_JSON);
    const result = await parseLlmJson<typeof COMPLETE_ANALYSIS>(runLlm);
    expect(result.ok).toBe(true);
    expect(runLlm).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once and succeeds when the second response parses", async () => {
    const runLlm = vi
      .fn()
      .mockResolvedValueOnce(COMPLETE_JSON.slice(0, 40)) // truncated first attempt
      .mockResolvedValueOnce(COMPLETE_JSON);
    const result = await parseLlmJson<typeof COMPLETE_ANALYSIS>(runLlm);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(COMPLETE_ANALYSIS);
    expect(runLlm).toHaveBeenCalledTimes(2);
  });

  it("returns a structured failure (never a fake success) after two bad responses", async () => {
    const runLlm = vi.fn().mockResolvedValue(COMPLETE_JSON.slice(0, 40));
    const result = await parseLlmJson(runLlm);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("truncated");
    expect(runLlm).toHaveBeenCalledTimes(2);
  });

  it("propagates API errors without retrying them", async () => {
    const runLlm = vi.fn().mockRejectedValue(new Error("529 overloaded"));
    await expect(parseLlmJson(runLlm)).rejects.toThrow("529 overloaded");
    expect(runLlm).toHaveBeenCalledTimes(1);
  });
});
