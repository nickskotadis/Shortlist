// ── Harness pipeline: mirrors app/api/generate/route.ts orchestration ─────────
// Every prompt, every parser, and the verdict logic are IMPORTED from lib/ —
// nothing is reimplemented here. What this file reproduces is the sequencing
// (parse -> build -> generate -> validate -> conditional retry) that lives
// inline inside the route's ReadableStream and cannot be imported.
//
// Divergences from the route, all deliberate and all reported in docs/benchmark.md:
//   1. No Upstash JD cache read/write. A cache hit would zero out the parse
//      stage and destroy the A/B comparison, so every run parses for real.
//   2. No Supabase auth, rate limiting, or DB insert.
//   3. No SSE emission and no Stage 5 tailoring call (which fires after `done`
//      and whose tokens the route does not count anyway).
//   4. Model IDs come from the config under test rather than from MODELS.

import { MAX_RETRIES } from "../../lib/constants";
import { parseJson, parseLlmJson } from "../../lib/llm-json";
import { GENERATOR_SYSTEM_PROMPT, MAX_TOKENS, buildDocPrompt } from "../../lib/pipeline";
import {
  buildJdParserPrompt,
  buildRetryPrompt,
  buildUserTypeBlock,
  buildValidatorPrompt,
  resolveVerdict,
} from "../../lib/prompts";
import type {
  DocumentType,
  JdAnalysis,
  ToneType,
  UserData,
  UserType,
  ValidatorResult,
} from "../../lib/types";
import { JD_MAX_CHARS, type Fixture } from "./fixtures";
import { callMessage, callStream, type CallContext, type Recorder, type Stage } from "./instrument";

export interface ModelRouting {
  label: string;
  parser: string;
  generator: string;
  validator: string;
}

export interface PipelineOutcome {
  rejected: boolean;
  rejectionReason: string | null;

  /** Parse diagnostics — the route discards these (route.ts:245). */
  jdParseOk: boolean;
  jdParseFailReason: string | null;
  jdAnalysisKeys: number;

  outputChars: number;
  generateStopReason: string | null;
  generateTruncated: boolean;

  validator: ValidatorResult | null;
  /** True when parseLlmJson had to call the model a second time. */
  validatorRetriedParse: boolean;
  validatorFirstParseFailReason: string | null;
  validatorUnavailable: boolean;

  retryCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  /** Sum of per-stage wall-clock; excludes harness-side backoff sleeps. */
  totalWallMs: number;
  failedCalls: number;
  keywords: string[];
}

export interface RunOpts {
  fixture: Fixture;
  routing: ModelRouting;
  run: number;
  documentType: DocumentType;
  userType: UserType;
  userData: UserData;
  candidateInput: string;
  tone: ToneType;
  experiment: string;
  recorder: Recorder;
  rand: () => number;
  dryRun: boolean;
  /** Overrides the doc prompt builder for the prompt-version experiment. */
  docPromptOverride?: (args: {
    userTypeBlock: string;
    jdAnalysis: Partial<JdAnalysis>;
    candidateInput: string;
    tone: ToneType;
  }) => string;
  promptVersionLabel?: string;
}

export async function runPipeline(opts: RunOpts): Promise<PipelineOutcome> {
  const { fixture, routing, recorder, rand, dryRun } = opts;

  const base = {
    experiment: opts.experiment,
    jd_file: fixture.file,
    jd_category: fixture.category,
    jd_chars: fixture.chars,
    config: routing.label,
    run: opts.run,
    doc_type: opts.documentType,
  };
  const ctx = (stage: Stage, model: string): CallContext => ({ ...base, stage, model });
  const deps = { recorder, rand, dryRun };

  const outcome: PipelineOutcome = {
    rejected: false,
    rejectionReason: null,
    jdParseOk: false,
    jdParseFailReason: null,
    jdAnalysisKeys: 0,
    outputChars: 0,
    generateStopReason: null,
    generateTruncated: false,
    validator: null,
    validatorRetriedParse: false,
    validatorFirstParseFailReason: null,
    validatorUnavailable: false,
    retryCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalWallMs: 0,
    failedCalls: 0,
    keywords: [],
  };

  // ── Input validation, mirroring route.ts LIMITS ─────────────────────────────
  // Over-cap JDs are rejected here exactly as the route rejects them, with zero
  // API calls. This is a measured finding, not a skipped test.
  if (fixture.chars > JD_MAX_CHARS) {
    outcome.rejected = true;
    outcome.rejectionReason = "jd_over_max_chars";
    recorder.event({
      ...base,
      outcome: "input_validation_rejected",
      reason: "jd_over_max_chars",
      jd_chars: fixture.chars,
      limit: JD_MAX_CHARS,
      ts: new Date().toISOString(),
    });
    return outcome;
  }

  // ── Stage 1: JD parse ───────────────────────────────────────────────────────
  let jdAnalysis: Partial<JdAnalysis> = {};
  const parseRes = await callMessage(ctx("parse", routing.parser), deps, {
    model: routing.parser,
    max_tokens: MAX_TOKENS.parser,
    prompt: buildJdParserPrompt(fixture.text),
  });
  outcome.totalInputTokens += parseRes.inputTokens;
  outcome.totalOutputTokens += parseRes.outputTokens;
  outcome.totalWallMs += parseRes.wallMs;
  if (!parseRes.ok) outcome.failedCalls++;

  if (parseRes.ok) {
    const parsed = parseJson<Partial<JdAnalysis>>(parseRes.text);
    outcome.jdParseOk = parsed.ok;
    if (parsed.ok) {
      jdAnalysis = parsed.value;
    } else {
      // The route collapses this to {} and proceeds (route.ts:245). So do we —
      // but unlike the route, we record which failure mode it was.
      outcome.jdParseFailReason = parsed.reason;
      jdAnalysis = {};
    }
  }
  outcome.jdAnalysisKeys = Object.keys(jdAnalysis).length;
  outcome.keywords = Array.isArray(jdAnalysis.key_terminology) ? jdAnalysis.key_terminology : [];

  // ── Stage 2: Build generator prompt ─────────────────────────────────────────
  const userTypeBlock = buildUserTypeBlock(opts.userType, opts.userData);
  const buildPrompt = () =>
    opts.docPromptOverride
      ? opts.docPromptOverride({
          userTypeBlock,
          jdAnalysis,
          candidateInput: opts.candidateInput,
          tone: opts.tone,
        })
      : buildDocPrompt({
          documentType: opts.documentType,
          userTypeBlock,
          jdAnalysis,
          candidateInput: opts.candidateInput,
          tone: opts.tone,
          userData: opts.userData,
          jdText: fixture.text,
        });

  // ── Stage 3: Generate (streamed, as production does) ────────────────────────
  const generate = async (prompt: string, stage: Stage) => {
    const res = await callStream(ctx(stage, routing.generator), deps, {
      model: routing.generator,
      max_tokens: MAX_TOKENS.generator,
      system: GENERATOR_SYSTEM_PROMPT,
      prompt,
    });
    outcome.totalInputTokens += res.inputTokens;
    outcome.totalOutputTokens += res.outputTokens;
    outcome.totalWallMs += res.wallMs;
    if (!res.ok) outcome.failedCalls++;
    outcome.generateStopReason = res.stopReason;
    // The route never inspects stop_reason, so a truncated 2048-token output is
    // invisible in production. We count it.
    if (res.stopReason === "max_tokens") outcome.generateTruncated = true;
    return res.text;
  };

  let fullText = await generate(buildPrompt(), "generate");

  // ── Stage 4: Validate ───────────────────────────────────────────────────────
  const validate = async (text: string, stage: Stage): Promise<ValidatorResult> => {
    let attempts = 0;
    let firstFailReason: string | null = null;

    // parseLlmJson calls this closure once, and once more if the first response
    // does not parse. Counting invocations is how we detect the retry-parser
    // path without altering it.
    const parsed = await parseLlmJson<ValidatorResult>(async () => {
      attempts++;
      const res = await callMessage(
        // attempts > 1 means parseLlmJson is re-calling the model because the
        // first response did not parse — a distinct stage from re-validating
        // after a generation retry.
        ctx(attempts === 1 ? stage : "validate_parse_retry", routing.validator),
        deps,
        {
          model: routing.validator,
          max_tokens: MAX_TOKENS.validator,
          prompt: buildValidatorPrompt(
            opts.documentType,
            jdAnalysis,
            text,
            opts.userType,
            opts.candidateInput
          ),
        }
      );
      outcome.totalInputTokens += res.inputTokens;
      outcome.totalOutputTokens += res.outputTokens;
      outcome.totalWallMs += res.wallMs;
      if (!res.ok) outcome.failedCalls++;

      if (attempts === 1) {
        const probe = parseJson<ValidatorResult>(res.text);
        if (!probe.ok) firstFailReason = probe.reason;
      }
      return res.text;
    });

    // Accumulate rather than assign: a generation can be validated twice (once
    // initially, once after a generation retry) and either validation may have
    // needed a parse-recovery call. Assigning would let the second validation
    // erase the first's flag and undercount the recovery path.
    outcome.validatorRetriedParse ||= attempts > 1;
    outcome.validatorFirstParseFailReason ??= firstFailReason;

    if (parsed.ok) {
      // The route overwrites the model's own verdict with resolveVerdict.
      parsed.value.verdict = resolveVerdict(parsed.value);
      return parsed.value;
    }

    // Fail CLOSED, exactly as the route does — never a fabricated PASS.
    outcome.validatorUnavailable = true;
    return {
      scores: { specificity: 0, relevance: 0, authenticity: 0, impact: 0, clean: 0 },
      overall: 0,
      issues: [],
      verdict: "REVISE",
      verdict_reason: "Quality validation unavailable — output not graded.",
      unavailable: true,
    };
  };

  let validatorResult = await validate(fullText, "validate");

  // ── Retry gate (MAX_RETRIES = 1) ────────────────────────────────────────────
  if (
    !validatorResult.unavailable &&
    validatorResult.verdict !== "PASS" &&
    outcome.retryCount < MAX_RETRIES
  ) {
    outcome.retryCount++;
    const retryPrompt = buildRetryPrompt(
      buildPrompt(),
      validatorResult.issues ?? [],
      validatorResult.verdict_reason ?? ""
    );
    fullText = await generate(retryPrompt, "generate_retry");
    validatorResult = await validate(fullText, "validate_retry");
  }

  outcome.validator = validatorResult;
  outcome.outputChars = fullText.length;

  recorder.event({
    ...base,
    outcome: "completed",
    prompt_version: opts.promptVersionLabel ?? null,
    jd_parse_ok: outcome.jdParseOk,
    jd_parse_fail_reason: outcome.jdParseFailReason,
    jd_analysis_keys: outcome.jdAnalysisKeys,
    generate_stop_reason: outcome.generateStopReason,
    generate_truncated: outcome.generateTruncated,
    validator_retried_parse: outcome.validatorRetriedParse,
    validator_first_parse_fail_reason: outcome.validatorFirstParseFailReason,
    validator_unavailable: outcome.validatorUnavailable,
    overall: validatorResult.overall,
    scores: validatorResult.scores,
    verdict: validatorResult.verdict,
    issue_types: (validatorResult.issues ?? []).map((i) => i.type),
    issue_count: (validatorResult.issues ?? []).length,
    retry_count: outcome.retryCount,
    input_tokens: outcome.totalInputTokens,
    output_tokens: outcome.totalOutputTokens,
    wall_ms: outcome.totalWallMs,
    failed_calls: outcome.failedCalls,
    output_chars: outcome.outputChars,
    ts: new Date().toISOString(),
  });

  // Full text to the gitignored outputs file only — never to console.
  recorder.output({
    ...base,
    prompt_version: opts.promptVersionLabel ?? null,
    output: fullText,
    validator: validatorResult,
  });

  return outcome;
}
