// ── Robust LLM JSON parsing ───────────────────────────────────────────────────
// LLMs wrap JSON in code fences, add prose preambles ("Here is the result:"),
// or truncate at max_tokens mid-object. A single JSON.parse(stripCodeFences(raw))
// turns any of these into a hard failure. This module extracts the outermost
// JSON value from noisy output, distinguishes truncation from malformed output,
// and retries the LLM call once before giving up with a structured error.

export type ParseFailureReason = "empty" | "truncated" | "invalid";

export interface ParseOk<T> {
  ok: true;
  value: T;
}
export interface ParseErr {
  ok: false;
  reason: ParseFailureReason;
  error: string;
}
export type ParseResult<T> = ParseOk<T> | ParseErr;

// Scan `text` for the outermost balanced JSON value (object or array), ignoring
// surrounding prose and code fences. Brace/bracket counting is string- and
// escape-aware. Returns the substring, or a reason if none/incomplete.
function extractJsonValue(
  text: string
): { value: string } | { fail: ParseFailureReason } {
  const trimmed = text.trim();
  if (!trimmed) return { fail: "empty" };

  // Find the first opening brace/bracket.
  let start = -1;
  let opener = "";
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === "{" || c === "[") {
      start = i;
      opener = c;
      break;
    }
  }
  if (start === -1) return { fail: "invalid" };

  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === opener) depth++;
    else if (c === closer) {
      depth--;
      if (depth === 0) return { value: trimmed.slice(start, i + 1) };
    }
  }

  // Opened but never closed → the model was cut off (truncation).
  return { fail: "truncated" };
}

// Extract + JSON.parse a single LLM response. Pure, no LLM call.
export function parseJson<T>(raw: string): ParseResult<T> {
  const extracted = extractJsonValue(raw);
  if ("fail" in extracted) {
    const error =
      extracted.fail === "truncated"
        ? "The response was cut off before it finished."
        : extracted.fail === "empty"
          ? "The model returned an empty response."
          : "The response did not contain valid JSON.";
    return { ok: false, reason: extracted.fail, error };
  }
  try {
    return { ok: true, value: JSON.parse(extracted.value) as T };
  } catch {
    return {
      ok: false,
      reason: "invalid",
      error: "The response did not contain valid JSON.",
    };
  }
}

// Run an LLM call, parse its JSON, and retry the call once on parse failure
// before returning a structured error. `runLlm` returns the raw model text;
// exceptions from `runLlm` (API/network errors) propagate to the caller and are
// NOT retried here — only parse failures trigger the single retry.
export async function parseLlmJson<T>(
  runLlm: () => Promise<string>
): Promise<ParseResult<T>> {
  const first = parseJson<T>(await runLlm());
  if (first.ok) return first;
  const second = parseJson<T>(await runLlm());
  return second;
}
