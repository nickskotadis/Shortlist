import { describe, it, expect } from "vitest";

import { resolveVerdict } from "@/lib/prompts";
import type { ValidatorResult } from "@/lib/types";

// Past defect class: a validation layer that returns PASS when it fails to run.
// The generate route fails closed by substituting all-zero scores when the
// validator response is unparseable — these tests pin that an all-zero (or
// otherwise deficient) result can never resolve to PASS.

function validatorResult(
  overall: number,
  scores: ValidatorResult["scores"]
): Parameters<typeof resolveVerdict>[0] {
  return { overall, scores, verdict: "PASS", issues: [] };
}

const ZERO_SCORES = { specificity: 0, relevance: 0, authenticity: 0, impact: 0, clean: 0 };
const GOOD_SCORES = { specificity: 8, relevance: 8, authenticity: 7, impact: 8, clean: 9 };

describe("resolveVerdict — fails closed", () => {
  it("rejects the all-zero result the route substitutes when validation cannot run", () => {
    // Even though the (unparseable) model output claimed verdict PASS, the
    // resolved verdict must be REJECT — never a fabricated pass.
    expect(resolveVerdict(validatorResult(0, ZERO_SCORES))).toBe("REJECT");
  });

  it("never passes when a single dimension is below the minimum", () => {
    const oneWeakDimension = { ...GOOD_SCORES, authenticity: 5 };
    expect(resolveVerdict(validatorResult(7.5, oneWeakDimension))).not.toBe("PASS");
  });

  it("never passes when the overall score is below the pass threshold", () => {
    expect(resolveVerdict(validatorResult(6.9, GOOD_SCORES))).toBe("REVISE");
  });

  it("rejects outright below the revise threshold", () => {
    expect(resolveVerdict(validatorResult(5.4, ZERO_SCORES))).toBe("REJECT");
  });

  it("passes a genuinely good result (the gate can open, so the tests above can fail)", () => {
    expect(resolveVerdict(validatorResult(7.0, GOOD_SCORES))).toBe("PASS");
  });

  it("ignores the model's self-reported verdict in favor of the scores", () => {
    // The model saying "PASS" with failing scores must not leak through.
    expect(
      resolveVerdict({ overall: 3, scores: ZERO_SCORES, verdict: "PASS", issues: [] })
    ).toBe("REJECT");
  });
});
