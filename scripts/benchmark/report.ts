// ── Aggregation: raw JSONL -> summary object -> markdown tables ──────────────

import { readFileSync } from "node:fs";
import { costUsd } from "./pricing";

export interface CallRow {
  kind: "call" | "retry";
  experiment: string;
  jd_file: string;
  jd_category: string;
  jd_chars: number;
  config: string;
  run: number;
  doc_type: string;
  stage: string;
  model: string;
  attempt: number;
  ok: boolean;
  wall_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  http_status: number | null;
  stop_reason: string | null;
  ttft_ms: number | null;
  error_type: string | null;
}

export interface EventRow {
  kind: "event";
  experiment: string;
  jd_file: string;
  jd_category: string;
  jd_chars: number;
  config: string;
  run: number;
  doc_type: string;
  outcome: string;
  reason?: string;
  prompt_version?: string | null;
  jd_parse_ok?: boolean;
  jd_parse_fail_reason?: string | null;
  jd_analysis_keys?: number;
  generate_stop_reason?: string | null;
  generate_truncated?: boolean;
  validator_retried_parse?: boolean;
  validator_first_parse_fail_reason?: string | null;
  validator_unavailable?: boolean;
  overall?: number;
  scores?: Record<string, number>;
  verdict?: string;
  issue_types?: string[];
  issue_count?: number;
  retry_count?: number;
  input_tokens?: number;
  output_tokens?: number;
  wall_ms?: number;
  failed_calls?: number;
}

export type Row = CallRow | EventRow;

export function loadRows(path: string): Row[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Row);
}

export const isCall = (r: Row): r is CallRow => r.kind === "call" || r.kind === "retry";
export const isEvent = (r: Row): r is EventRow => r.kind === "event";

// ── Statistics ────────────────────────────────────────────────────────────────
export function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * s.length) - 1;
  return s[Math.max(0, Math.min(idx, s.length - 1))];
}

export const mean = (xs: number[]): number =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface LatencyStats {
  n: number;
  mean: number;
  p50: number;
  p90: number;
  p95: number;
}

export function latencyStats(xs: number[]): LatencyStats {
  return {
    n: xs.length,
    mean: Math.round(mean(xs)),
    p50: Math.round(percentile(xs, 50)),
    p90: Math.round(percentile(xs, 90)),
    p95: Math.round(percentile(xs, 95)),
  };
}

// ── Experiment 1: routing cost and latency ────────────────────────────────────
export interface StageAgg {
  stage: string;
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latency: LatencyStats;
}

export interface ConfigAgg {
  config: string;
  generations: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  meanCostPerGeneration: number;
  latency: LatencyStats;
  byStage: StageAgg[];
  perRun: {
    run: number;
    generations: number;
    totalCostUsd: number;
    meanCostPerGeneration: number;
    latency: LatencyStats;
  }[];
  /** Max pairwise |delta| between runs as a fraction, for cost and latency. */
  betweenRunCostSpread: number;
  betweenRunLatencySpread: number;
  unstable: boolean;
}

const spread = (a: number, b: number): number => {
  const lo = Math.min(a, b);
  if (lo === 0) return a === b ? 0 : 1;
  return Math.abs(a - b) / lo;
};

export function aggregateConfig(rows: Row[], experiment: string, config: string): ConfigAgg {
  const calls = rows
    .filter(isCall)
    .filter((r) => r.experiment === experiment && r.config === config && r.ok);
  const events = rows
    .filter(isEvent)
    .filter(
      (r) => r.experiment === experiment && r.config === config && r.outcome === "completed"
    );

  const cost = (rs: CallRow[]) =>
    rs.reduce((a, r) => a + costUsd(r.model, r.input_tokens ?? 0, r.output_tokens ?? 0), 0);

  const stages = [...new Set(calls.map((r) => r.stage))].sort();
  const byStage: StageAgg[] = stages.map((stage) => {
    const rs = calls.filter((r) => r.stage === stage);
    return {
      stage,
      model: rs[0]?.model ?? "",
      calls: rs.length,
      inputTokens: rs.reduce((a, r) => a + (r.input_tokens ?? 0), 0),
      outputTokens: rs.reduce((a, r) => a + (r.output_tokens ?? 0), 0),
      costUsd: cost(rs),
      latency: latencyStats(rs.map((r) => r.wall_ms)),
    };
  });

  const runs = [...new Set(events.map((r) => r.run))].sort();
  const perRun = runs.map((run) => {
    const rc = calls.filter((r) => r.run === run);
    const re = events.filter((r) => r.run === run);
    const c = cost(rc);
    return {
      run,
      generations: re.length,
      totalCostUsd: c,
      meanCostPerGeneration: re.length ? c / re.length : 0,
      latency: latencyStats(re.map((r) => r.wall_ms ?? 0)),
    };
  });

  const totalCost = cost(calls);
  const e2e = events.map((r) => r.wall_ms ?? 0);

  let costSpread = 0;
  let latSpread = 0;
  if (perRun.length >= 2) {
    costSpread = spread(perRun[0].meanCostPerGeneration, perRun[1].meanCostPerGeneration);
    latSpread = spread(perRun[0].latency.mean, perRun[1].latency.mean);
  }

  return {
    config,
    generations: events.length,
    inputTokens: calls.reduce((a, r) => a + (r.input_tokens ?? 0), 0),
    outputTokens: calls.reduce((a, r) => a + (r.output_tokens ?? 0), 0),
    totalCostUsd: totalCost,
    meanCostPerGeneration: events.length ? totalCost / events.length : 0,
    latency: latencyStats(e2e),
    byStage,
    perRun,
    betweenRunCostSpread: costSpread,
    betweenRunLatencySpread: latSpread,
    unstable: costSpread > 0.1 || latSpread > 0.1,
  };
}

// ── Experiment 2: validator quality ───────────────────────────────────────────
export interface QualityAgg {
  label: string;
  n: number;
  meanOverall: number;
  medianOverall: number;
  distribution: Record<string, number>;
  passRate: number;
  passCount: number;
  reviseCount: number;
  rejectCount: number;
  unavailableCount: number;
  retryRate: number;
  meanDimensions: Record<string, number>;
  flagsByType: Record<string, number>;
  totalFlags: number;
  meanFlagsPerGeneration: number;
  flagsByCategory: Record<string, { generations: number; flags: number; perGeneration: number }>;
}

const BUCKETS = ["<4", "4–5", "5–6", "6–7", "7–8", "8–9", "9–10"];
function bucketOf(x: number): string {
  if (x < 4) return "<4";
  if (x < 5) return "4–5";
  if (x < 6) return "5–6";
  if (x < 7) return "6–7";
  if (x < 8) return "7–8";
  if (x < 9) return "8–9";
  return "9–10";
}

export function aggregateQuality(events: EventRow[], label: string): QualityAgg {
  const graded = events.filter((e) => !e.validator_unavailable);
  const overalls = graded.map((e) => e.overall ?? 0);

  const distribution: Record<string, number> = Object.fromEntries(BUCKETS.map((b) => [b, 0]));
  for (const o of overalls) distribution[bucketOf(o)]++;

  const dims = ["specificity", "relevance", "authenticity", "impact", "clean"];
  const meanDimensions: Record<string, number> = {};
  for (const d of dims) {
    meanDimensions[d] = Number(mean(graded.map((e) => e.scores?.[d] ?? 0)).toFixed(2));
  }

  const flagsByType: Record<string, number> = {};
  for (const e of events) for (const t of e.issue_types ?? []) flagsByType[t] = (flagsByType[t] ?? 0) + 1;
  const totalFlags = Object.values(flagsByType).reduce((a, b) => a + b, 0);

  const flagsByCategory: QualityAgg["flagsByCategory"] = {};
  for (const cat of [...new Set(events.map((e) => e.jd_category))].sort()) {
    const group = events.filter((e) => e.jd_category === cat);
    const f = group.reduce((a, e) => a + (e.issue_types?.length ?? 0), 0);
    flagsByCategory[cat] = {
      generations: group.length,
      flags: f,
      perGeneration: group.length ? Number((f / group.length).toFixed(2)) : 0,
    };
  }

  const passCount = events.filter((e) => e.verdict === "PASS").length;

  return {
    label,
    n: events.length,
    meanOverall: Number(mean(overalls).toFixed(2)),
    medianOverall: Number(median(overalls).toFixed(2)),
    distribution,
    passRate: events.length ? passCount / events.length : 0,
    passCount,
    reviseCount: events.filter((e) => e.verdict === "REVISE" && !e.validator_unavailable).length,
    rejectCount: events.filter((e) => e.verdict === "REJECT").length,
    unavailableCount: events.filter((e) => e.validator_unavailable).length,
    retryRate: events.length
      ? events.filter((e) => (e.retry_count ?? 0) > 0).length / events.length
      : 0,
    meanDimensions,
    flagsByType,
    totalFlags,
    meanFlagsPerGeneration: events.length ? Number((totalFlags / events.length).toFixed(2)) : 0,
    flagsByCategory,
  };
}

// ── Experiment 3: reliability ─────────────────────────────────────────────────
export interface ReliabilityAgg {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  retryAttempts: number;
  failuresByType: Record<string, number>;
  exhaustedRetries: number;
  jdParseFailures: Record<string, number>;
  jdParseOkCount: number;
  jdParseTotal: number;
  emptyJdAnalysis: number;
  validatorParseRetries: number;
  validatorFirstParseFailures: Record<string, number>;
  validatorUnavailable: number;
  generateTruncated: number;
  stopReasons: Record<string, number>;
  inputValidationRejected: number;
}

export function aggregateReliability(rows: Row[]): ReliabilityAgg {
  const calls = rows.filter(isCall);
  const terminalFailures = calls.filter((r) => r.kind === "call" && !r.ok);
  const events = rows.filter(isEvent);
  const completed = events.filter((e) => e.outcome === "completed");

  const failuresByType: Record<string, number> = {};
  for (const r of calls.filter((c) => !c.ok)) {
    const t = r.error_type ?? "unknown";
    failuresByType[t] = (failuresByType[t] ?? 0) + 1;
  }

  const jdParseFailures: Record<string, number> = {};
  for (const e of completed) {
    if (e.jd_parse_fail_reason) {
      jdParseFailures[e.jd_parse_fail_reason] = (jdParseFailures[e.jd_parse_fail_reason] ?? 0) + 1;
    }
  }

  const validatorFirstParseFailures: Record<string, number> = {};
  for (const e of completed) {
    if (e.validator_first_parse_fail_reason) {
      const k = e.validator_first_parse_fail_reason;
      validatorFirstParseFailures[k] = (validatorFirstParseFailures[k] ?? 0) + 1;
    }
  }

  const stopReasons: Record<string, number> = {};
  for (const r of calls.filter((c) => c.ok && c.stop_reason)) {
    const k = `${r.stage}:${r.stop_reason}`;
    stopReasons[k] = (stopReasons[k] ?? 0) + 1;
  }

  return {
    totalCalls: calls.filter((c) => c.kind === "call").length,
    successfulCalls: calls.filter((c) => c.ok).length,
    failedCalls: terminalFailures.length,
    retryAttempts: calls.filter((c) => c.kind === "retry").length,
    failuresByType,
    // A terminal failure recorded at attempt 6 means backoff was exhausted.
    exhaustedRetries: terminalFailures.filter((r) => r.attempt >= 6).length,
    jdParseFailures,
    jdParseOkCount: completed.filter((e) => e.jd_parse_ok).length,
    jdParseTotal: completed.length,
    emptyJdAnalysis: completed.filter((e) => (e.jd_analysis_keys ?? 0) === 0).length,
    validatorParseRetries: completed.filter((e) => e.validator_retried_parse).length,
    validatorFirstParseFailures,
    validatorUnavailable: completed.filter((e) => e.validator_unavailable).length,
    generateTruncated: completed.filter((e) => e.generate_truncated).length,
    stopReasons,
    inputValidationRejected: events.filter((e) => e.outcome === "input_validation_rejected").length,
  };
}

export function totalSpend(rows: Row[]): number {
  return rows
    .filter(isCall)
    .filter((r) => r.ok)
    .reduce((a, r) => a + costUsd(r.model, r.input_tokens ?? 0, r.output_tokens ?? 0), 0);
}

export const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
