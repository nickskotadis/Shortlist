// ── Instrumentation: the single choke point for every Anthropic API call ──────
// Every call the benchmark makes goes through here so that timing, token usage,
// HTTP status, retries, and failures are recorded uniformly and written to disk
// immediately.

import Anthropic from "@anthropic-ai/sdk";
import { closeSync, fsyncSync, openSync, writeSync } from "node:fs";

// Lazy singleton. The client must NOT be constructed at module load: run.ts
// populates process.env from .env/.env.local during preflight, which happens
// after this module is imported. Constructing eagerly captures an undefined
// API key and every call fails with an opaque local error.
// (Same trap as lib/stripe.ts, for the same reason.)
let _anthropic: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set at call time");
    // The SDK's built-in retry is DISABLED. If the SDK retried internally it
    // would (a) hide 429s and 529s from these records and (b) fold the retry
    // wait into a single call's measured wall-clock, corrupting latency. The
    // harness owns retry policy explicitly instead.
    _anthropic = new Anthropic({ apiKey, maxRetries: 0 });
  }
  return _anthropic;
}

export type Stage =
  | "parse"
  // Second parser call made by parseLlmJson when the first response did not
  // parse. Mirrors validate_parse_retry on the validation side.
  | "parse_retry"
  | "generate"
  | "validate"
  // Validation of the output produced by a generation retry.
  | "validate_retry"
  | "generate_retry"
  // The SECOND model call inside a single validation, made by parseLlmJson when
  // the first response did not parse. Distinct from validate_retry: this is a
  // JSON-recovery call, not a re-validation after regeneration. Conflating the
  // two makes the per-stage cost table ambiguous.
  | "validate_parse_retry";

export interface CallContext {
  experiment: string;
  jd_file: string;
  jd_category: string;
  jd_chars: number;
  config: string;
  run: number;
  doc_type: string;
  stage: Stage;
  model: string;
}

export interface CallRecord extends CallContext {
  kind: "call" | "retry";
  attempt: number;
  ok: boolean;
  wall_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_input_tokens: number | null;
  http_status: number | null;
  stop_reason: string | null;
  output_chars: number | null;
  /** Time to first streamed token; only populated for streamed calls. */
  ttft_ms: number | null;
  error_type: string | null;
  backoff_ms: number | null;
  ts: string;
}

// ── Retry policy ──────────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 6;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 60_000;

export interface ErrorInfo {
  type: string;
  status: number | null;
  retryable: boolean;
}

export function classifyError(err: unknown): ErrorInfo {
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return { type: "connection_timeout", status: null, retryable: true };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { type: "connection", status: null, retryable: true };
  }
  if (err instanceof Anthropic.APIError) {
    const status = typeof err.status === "number" ? err.status : null;
    if (status === 429) return { type: "rate_limit_429", status, retryable: true };
    if (status === 529) return { type: "overloaded_529", status, retryable: true };
    if (status !== null && status >= 500) {
      return { type: `server_error_${status}`, status, retryable: true };
    }
    if (status === 401) return { type: "auth_401", status, retryable: false };
    if (status === 400) return { type: "bad_request_400", status, retryable: false };
    return { type: `api_error_${status ?? "unknown"}`, status, retryable: false };
  }
  if (err instanceof Error) {
    // Include the message: a bare "local_Error" is undebuggable after the fact.
    return {
      type: `local_${err.name}: ${err.message.slice(0, 120)}`,
      status: null,
      retryable: false,
    };
  }
  return { type: `unknown: ${String(err).slice(0, 120)}`, status: null, retryable: false };
}

/** Exponential backoff, base 2s, doubling, capped at 60s, with full jitter. */
function backoffDelay(attempt: number, rand: () => number): number {
  const ceiling = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
  return Math.floor(rand() * ceiling);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Recorder ──────────────────────────────────────────────────────────────────
/**
 * Appends one JSON object per line and fsyncs immediately. A crash at JD 38
 * loses at most the call currently in flight.
 */
export class Recorder {
  private rawFd: number;
  private outFd: number;
  private closed = false;

  constructor(rawPath: string, outputsPath: string) {
    this.rawFd = openSync(rawPath, "a");
    this.outFd = openSync(outputsPath, "a");
  }

  record(rec: CallRecord): void {
    writeSync(this.rawFd, JSON.stringify(rec) + "\n");
    fsyncSync(this.rawFd);
  }

  /** Non-call events: pipeline outcomes, validator results, rejections. */
  event(obj: Record<string, unknown>): void {
    writeSync(this.rawFd, JSON.stringify({ kind: "event", ...obj }) + "\n");
    fsyncSync(this.rawFd);
  }

  /**
   * Full generated text goes to a separate gitignored file for spot-checking.
   * Never printed to console — consistent with the app's PII stance.
   */
  output(obj: Record<string, unknown>): void {
    writeSync(this.outFd, JSON.stringify(obj) + "\n");
    fsyncSync(this.outFd);
  }

  /** Idempotent — the estimate-only path and the finally block both call it. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    closeSync(this.rawFd);
    closeSync(this.outFd);
  }
}

// ── Call wrappers ─────────────────────────────────────────────────────────────

export interface CallResult {
  ok: boolean;
  text: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string | null;
  wallMs: number;
  ttftMs: number | null;
  errorType: string | null;
}

interface Deps {
  recorder: Recorder;
  rand: () => number;
  dryRun: boolean;
  onSleep?: (ms: number) => void;
}

async function withRetry(
  ctx: CallContext,
  deps: Deps,
  attemptFn: () => Promise<{
    text: string;
    inputTokens: number;
    outputTokens: number;
    cacheRead: number | null;
    stopReason: string | null;
    ttftMs: number | null;
  }>
): Promise<CallResult> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const started = Date.now();
    try {
      const r = await attemptFn();
      const wallMs = Date.now() - started;
      deps.recorder.record({
        ...ctx,
        kind: "call",
        attempt,
        ok: true,
        wall_ms: wallMs,
        input_tokens: r.inputTokens,
        output_tokens: r.outputTokens,
        cache_read_input_tokens: r.cacheRead,
        http_status: 200,
        stop_reason: r.stopReason,
        output_chars: r.text.length,
        ttft_ms: r.ttftMs,
        error_type: null,
        backoff_ms: null,
        ts: new Date().toISOString(),
      });
      return {
        ok: true,
        text: r.text,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        stopReason: r.stopReason,
        wallMs,
        ttftMs: r.ttftMs,
        errorType: null,
      };
    } catch (err) {
      const wallMs = Date.now() - started;
      const info = classifyError(err);
      const isLast = attempt === MAX_ATTEMPTS;
      const willRetry = info.retryable && !isLast;
      const delay = willRetry ? backoffDelay(attempt, deps.rand) : null;

      deps.recorder.record({
        ...ctx,
        kind: willRetry ? "retry" : "call",
        attempt,
        ok: false,
        wall_ms: wallMs,
        input_tokens: null,
        output_tokens: null,
        cache_read_input_tokens: null,
        http_status: info.status,
        stop_reason: null,
        output_chars: null,
        ttft_ms: null,
        error_type: info.type,
        backoff_ms: delay,
        ts: new Date().toISOString(),
      });

      if (!willRetry) {
        // Exhausted retries or non-retryable: record as failed and let the
        // caller continue. The run never aborts on a single call failure.
        return {
          ok: false,
          text: "",
          inputTokens: 0,
          outputTokens: 0,
          stopReason: null,
          wallMs,
          ttftMs: null,
          errorType: info.type,
        };
      }

      console.log(
        `      retry ${attempt}/${MAX_ATTEMPTS - 1} after ${info.type} — backing off ${delay}ms`
      );
      deps.onSleep?.(delay!);
      if (!deps.dryRun) await sleep(delay!);
    }
  }
  /* istanbul ignore next — unreachable */
  throw new Error("unreachable");
}

/**
 * Synthetic response for --dry-run. Exercises checkpointing, JSONL writing,
 * shuffling, and aggregation at zero cost. Token counts are rough estimates
 * from prompt length so the cost aggregation has something plausible to chew on;
 * they are NOT a cost estimate and are never reported as one.
 */
function dryRunResult(
  ctx: CallContext,
  promptChars: number,
  maxTokens: number,
  stage: Stage
): CallResult {
  const inputTokens = Math.round(promptChars / 3.7);
  const outputTokens = Math.min(maxTokens, stage.startsWith("generate") ? 520 : 340);
  const text =
    stage.startsWith("generate")
      ? "DRY RUN OUTPUT ".repeat(40)
      : JSON.stringify({
          role_title: "Dry Run",
          key_terminology: ["dry", "run"],
          scores: { specificity: 8, relevance: 8, authenticity: 8, impact: 8, clean: 8 },
          overall: 8,
          issues: [],
          verdict: "PASS",
          verdict_reason: "dry run",
        });
  return {
    ok: true,
    text,
    inputTokens,
    outputTokens,
    stopReason: "end_turn",
    wallMs: 1,
    ttftMs: stage.startsWith("generate") ? 1 : null,
    errorType: null,
  };
}

/** Non-streaming call, matching how the route invokes the parser and validator. */
export async function callMessage(
  ctx: CallContext,
  deps: Deps,
  params: { model: string; max_tokens: number; system?: string; prompt: string }
): Promise<CallResult> {
  if (deps.dryRun) {
    const r = dryRunResult(ctx, params.prompt.length, params.max_tokens, ctx.stage);
    deps.recorder.record({
      ...ctx,
      kind: "call",
      attempt: 1,
      ok: true,
      wall_ms: r.wallMs,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      cache_read_input_tokens: null,
      http_status: 200,
      stop_reason: r.stopReason,
      output_chars: r.text.length,
      ttft_ms: r.ttftMs,
      error_type: null,
      backoff_ms: null,
      ts: new Date().toISOString(),
    });
    return r;
  }
  return withRetry(ctx, deps, async () => {
    const resp = await getAnthropic().messages.create({
      model: params.model,
      max_tokens: params.max_tokens,
      ...(params.system ? { system: params.system } : {}),
      messages: [{ role: "user", content: params.prompt }],
    });
    const text = resp.content[0]?.type === "text" ? resp.content[0].text : "";
    return {
      text,
      inputTokens: resp.usage.input_tokens,
      outputTokens: resp.usage.output_tokens,
      cacheRead: resp.usage.cache_read_input_tokens ?? null,
      stopReason: resp.stop_reason ?? null,
      ttftMs: null,
    };
  });
}

/**
 * Streaming call, matching how the route invokes the generator. Streaming is
 * used rather than a plain create() because production streams, and stream
 * duration is the latency a user actually experiences. Time to first token is
 * captured separately.
 */
export async function callStream(
  ctx: CallContext,
  deps: Deps,
  params: { model: string; max_tokens: number; system: string; prompt: string }
): Promise<CallResult> {
  if (deps.dryRun) {
    const r = dryRunResult(ctx, params.prompt.length + params.system.length, params.max_tokens, ctx.stage);
    deps.recorder.record({
      ...ctx,
      kind: "call",
      attempt: 1,
      ok: true,
      wall_ms: r.wallMs,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      cache_read_input_tokens: null,
      http_status: 200,
      stop_reason: r.stopReason,
      output_chars: r.text.length,
      ttft_ms: r.ttftMs,
      error_type: null,
      backoff_ms: null,
      ts: new Date().toISOString(),
    });
    return r;
  }
  return withRetry(ctx, deps, async () => {
    const startedAt = Date.now();
    let ttftMs: number | null = null;
    let full = "";

    const stream = getAnthropic().messages.stream({
      model: params.model,
      max_tokens: params.max_tokens,
      system: params.system,
      messages: [{ role: "user", content: params.prompt }],
    });

    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        if (ttftMs === null) ttftMs = Date.now() - startedAt;
        full += chunk.delta.text;
      }
    }

    const final = await stream.finalMessage();
    return {
      text: full,
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      cacheRead: final.usage.cache_read_input_tokens ?? null,
      stopReason: final.stop_reason ?? null,
      ttftMs,
    };
  });
}
