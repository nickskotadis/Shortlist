#!/usr/bin/env tsx
// Before/after comparison across two benchmark runs.
//
//   npx tsx scripts/benchmark/compare-runs.ts <run1.jsonl> <run2.jsonl>
//
// Schema-aware. The two runs were produced by different harness versions:
//
//   run 1  stage "validate_retry" CONFLATES post-generation-retry validation
//          with parseLlmJson recovery calls. Decomposed by arithmetic:
//          recovery = validate_retry calls - generations with retry_count > 0.
//          Event flag validator_retried_parse UNDERCOUNTS (assigned, not
//          accumulated, so a second validation erased the first's flag).
//          No JD-parse retry existed.
//
//   run 2  distinct stages parse / parse_retry / validate / validate_retry /
//          validate_parse_retry. Flags accumulate correctly.
//
// Anything that cannot be compared like-for-like is labelled rather than
// silently reconciled.

import { readFileSync } from "node:fs";

const PRICE: Record<string, [number, number]> = {
  "claude-sonnet-4-6": [3.0, 15.0],
  "claude-haiku-4-5-20251001": [1.0, 5.0],
};

interface Row {
  kind?: string;
  experiment?: string;
  config?: string;
  run?: number;
  stage?: string;
  model?: string;
  ok?: boolean;
  attempt?: number;
  wall_ms?: number;
  input_tokens?: number | null;
  output_tokens?: number | null;
  stop_reason?: string | null;
  error_type?: string | null;
  outcome?: string;
  jd_file?: string;
  jd_category?: string;
  jd_chars?: number;
  jd_parse_ok?: boolean;
  jd_parse_fail_reason?: string | null;
  jd_parse_retried?: boolean;
  jd_analysis_keys?: number;
  validator_unavailable?: boolean;
  validator_retried_parse?: boolean;
  overall?: number;
  scores?: Record<string, number>;
  verdict?: string;
  issue_types?: string[];
  retry_count?: number;
  generate_truncated?: boolean;
}

const load = (p: string): Row[] =>
  readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Row);

const cost = (r: Row): number => {
  const p = PRICE[r.model!];
  if (!p) return 0;
  return ((r.input_tokens ?? 0) * p[0] + (r.output_tokens ?? 0) * p[1]) / 1e6;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pctl = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.max(0, Math.min(Math.ceil((p / 100) * s.length) - 1, s.length - 1))];
};
const pctDelta = (before: number, after: number) =>
  before === 0 ? 0 : ((after - before) / before) * 100;

interface ConfigStats {
  gens: number;
  costTotal: number;
  costPerGen: number;
  latMean: number;
  latP50: number;
  latP90: number;
  latP95: number;
  inTok: number;
  outTok: number;
  retryRate: number;
  perRun: { run: number; costPerGen: number; latMean: number; meanOverall: number; passRate: number }[];
  meanOverall: number;
  medianOverall: number;
  passRate: number;
  unavailable: number;
  flagsPerGen: number;
  dims: Record<string, number>;
  dist: Record<string, number>;
}

function configStats(rows: Row[], cfg: string): ConfigStats {
  const calls = rows.filter(
    (r) => (r.kind === "call" || r.kind === "retry") && r.experiment === "exp1" && r.config === cfg && r.ok
  );
  const ev = rows.filter(
    (r) => r.kind === "event" && r.experiment === "exp1" && r.config === cfg && r.outcome === "completed"
  );
  const graded = ev.filter((e) => !e.validator_unavailable);
  const total = calls.reduce((a, r) => a + cost(r), 0);
  const lat = ev.map((e) => e.wall_ms ?? 0);

  const dims: Record<string, number> = {};
  for (const d of ["specificity", "relevance", "authenticity", "impact", "clean"]) {
    dims[d] = Number(mean(graded.map((e) => e.scores?.[d] ?? 0)).toFixed(2));
  }
  const dist: Record<string, number> = {};
  for (const e of graded) {
    const o = e.overall ?? 0;
    const b = o < 4 ? "<4" : o < 5 ? "4-5" : o < 6 ? "5-6" : o < 7 ? "6-7" : o < 8 ? "7-8" : o < 9 ? "8-9" : "9-10";
    dist[b] = (dist[b] ?? 0) + 1;
  }

  const runs = [...new Set(ev.map((e) => e.run!))].sort();
  const perRun = runs.map((run) => {
    const rc = calls.filter((r) => r.run === run);
    const re = ev.filter((e) => e.run === run);
    const rg = re.filter((e) => !e.validator_unavailable);
    const c = rc.reduce((a, r) => a + cost(r), 0);
    return {
      run,
      costPerGen: re.length ? c / re.length : 0,
      latMean: mean(re.map((e) => e.wall_ms ?? 0)),
      meanOverall: mean(rg.map((e) => e.overall ?? 0)),
      passRate: re.length ? re.filter((e) => e.verdict === "PASS").length / re.length : 0,
    };
  });

  return {
    gens: ev.length,
    costTotal: total,
    costPerGen: ev.length ? total / ev.length : 0,
    latMean: mean(lat),
    latP50: pctl(lat, 50),
    latP90: pctl(lat, 90),
    latP95: pctl(lat, 95),
    inTok: calls.reduce((a, r) => a + (r.input_tokens ?? 0), 0),
    outTok: calls.reduce((a, r) => a + (r.output_tokens ?? 0), 0),
    retryRate: ev.length ? ev.filter((e) => (e.retry_count ?? 0) > 0).length / ev.length : 0,
    meanOverall: mean(graded.map((e) => e.overall ?? 0)),
    medianOverall: median(graded.map((e) => e.overall ?? 0)),
    passRate: ev.length ? ev.filter((e) => e.verdict === "PASS").length / ev.length : 0,
    unavailable: ev.filter((e) => e.validator_unavailable).length,
    flagsPerGen: ev.length ? ev.reduce((a, e) => a + (e.issue_types?.length ?? 0), 0) / ev.length : 0,
    dims,
    dist,
    perRun,
  };
}

function stageTable(rows: Row[], cfg: string) {
  const calls = rows.filter(
    (r) => (r.kind === "call" || r.kind === "retry") && r.experiment === "exp1" && r.config === cfg && r.ok
  );
  const out: { stage: string; n: number; cost: number; latMean: number; outTok: number }[] = [];
  for (const stage of [...new Set(calls.map((r) => r.stage!))].sort()) {
    const rs = calls.filter((r) => r.stage === stage);
    out.push({
      stage,
      n: rs.length,
      cost: rs.reduce((a, r) => a + cost(r), 0),
      latMean: mean(rs.map((r) => r.wall_ms ?? 0)),
      outTok: rs.reduce((a, r) => a + (r.output_tokens ?? 0), 0),
    });
  }
  return out;
}

function blindness(rows: Row[]) {
  const ev = rows.filter((r) => r.kind === "event" && r.outcome === "completed");
  const byBucket: Record<string, { n: number; ok: number }> = {};
  for (const e of ev) {
    const k = (e.jd_chars ?? 0) > 13000 ? "long(>13k)" : "standard";
    byBucket[k] ??= { n: 0, ok: 0 };
    byBucket[k].n++;
    if (e.jd_parse_ok) byBucket[k].ok++;
  }
  return {
    total: ev.length,
    parseOk: ev.filter((e) => e.jd_parse_ok).length,
    empty: ev.filter((e) => (e.jd_analysis_keys ?? 0) === 0).length,
    byBucket,
    failReasons: ev.reduce<Record<string, number>>((a, e) => {
      if (e.jd_parse_fail_reason) a[e.jd_parse_fail_reason] = (a[e.jd_parse_fail_reason] ?? 0) + 1;
      return a;
    }, {}),
  };
}

function reliability(rows: Row[]) {
  const calls = rows.filter((r) => r.kind === "call" || r.kind === "retry");
  const ev = rows.filter((r) => r.kind === "event" && r.outcome === "completed");
  const atCap = (stages: string[]) =>
    calls.filter((r) => r.ok && stages.includes(r.stage!) && r.stop_reason === "max_tokens").length;
  return {
    totalCalls: calls.filter((c) => c.kind === "call").length,
    failures: calls.filter((c) => c.kind === "call" && !c.ok).length,
    retryAttempts: calls.filter((c) => c.kind === "retry").length,
    parserAtCap: atCap(["parse", "parse_retry"]),
    validatorAtCap: atCap(["validate", "validate_retry", "validate_parse_retry"]),
    generateAtCap: atCap(["generate", "generate_retry"]),
    validatorUnavailable: ev.filter((e) => e.validator_unavailable).length,
    // Schema-aware parse-recovery count.
    parseRecovery: calls.filter((r) => r.stage === "parse_retry" && r.ok).length,
    validatorRecovery: (() => {
      const explicit = calls.filter((r) => r.stage === "validate_parse_retry" && r.ok).length;
      if (explicit > 0) return { value: explicit, method: "explicit stage (run 2 schema)" };
      // run 1: decompose the conflated label
      const vr = calls.filter((r) => r.stage === "validate_retry" && r.ok).length;
      const gr = ev.filter((e) => (e.retry_count ?? 0) > 0).length;
      return { value: vr - gr, method: "arithmetic decomposition (run 1 schema)" };
    })(),
    inputRejected: rows.filter((r) => r.kind === "event" && r.outcome === "input_validation_rejected").length,
  };
}

function versionSeries(rows: Row[]) {
  const ev = rows.filter((r) => r.kind === "event" && r.outcome === "completed");
  const out: Record<string, { n: number; mean: number; pass: number; flags: number }> = {};
  for (const exp of [...new Set(ev.map((e) => e.experiment!))].filter((e) => e.startsWith("version:"))) {
    const g = ev.filter((e) => e.experiment === exp);
    const gr = g.filter((e) => !e.validator_unavailable);
    out[exp.replace("version:", "")] = {
      n: g.length,
      mean: Number(mean(gr.map((e) => e.overall ?? 0)).toFixed(3)),
      pass: g.length ? g.filter((e) => e.verdict === "PASS").length / g.length : 0,
      flags: g.length ? g.reduce((a, e) => a + (e.issue_types?.length ?? 0), 0) / g.length : 0,
    };
  }
  // Current version at run 1 only, for equal n against the historical series.
  const cur = ev.filter((e) => e.experiment === "exp1" && e.config === "A" && e.run === 1);
  const curG = cur.filter((e) => !e.validator_unavailable);
  out["bullets-v3 (run1 only)"] = {
    n: cur.length,
    mean: Number(mean(curG.map((e) => e.overall ?? 0)).toFixed(3)),
    pass: cur.length ? cur.filter((e) => e.verdict === "PASS").length / cur.length : 0,
    flags: cur.length ? cur.reduce((a, e) => a + (e.issue_types?.length ?? 0), 0) / cur.length : 0,
  };
  return out;
}

const [p1, p2] = process.argv.slice(2);
if (!p1 || !p2) {
  console.error("usage: compare-runs.ts <run1.jsonl> <run2.jsonl>");
  process.exit(1);
}
const r1 = load(p1);
const r2 = load(p2);

const A1 = configStats(r1, "A");
const A2 = configStats(r2, "A");
const B1 = configStats(r1, "B");
const B2 = configStats(r2, "B");

const spendAll = (rows: Row[]) =>
  rows.filter((r) => (r.kind === "call" || r.kind === "retry") && r.ok).reduce((a, r) => a + cost(r), 0);

const f = (n: number, d = 5) => n.toFixed(d);
const pc = (n: number) => `${(n * 100).toFixed(1)}%`;

console.log("=".repeat(92));
console.log("BEFORE / AFTER — run 1 (pre-fix) vs run 2 (post-fix)");
console.log("=".repeat(92));
console.log(`\ntotal spend:  run1 $${spendAll(r1).toFixed(4)}   run2 $${spendAll(r2).toFixed(4)}`);

// ── 1. JD-analysis blindness — the primary validation ────────────────────────
const b1 = blindness(r1);
const b2 = blindness(r2);
console.log("\n" + "─".repeat(92));
console.log("1. JD-ANALYSIS BLINDNESS  (primary validation — must be 0% in run 2)");
console.log("─".repeat(92));
for (const [label, b] of [["run1", b1], ["run2", b2]] as const) {
  console.log(
    `  ${label}: parse_ok ${b.parseOk}/${b.total} (${((100 * b.parseOk) / b.total).toFixed(1)}%)  ` +
      `empty {} ${b.empty} (${((100 * b.empty) / b.total).toFixed(1)}%)  fails ${JSON.stringify(b.failReasons)}`
  );
  for (const [k, v] of Object.entries(b.byBucket).sort()) {
    console.log(`     ${k.padEnd(12)} ${v.ok}/${v.n} (${((100 * v.ok) / v.n).toFixed(0)}%)`);
  }
}

// ── 2. Reliability ───────────────────────────────────────────────────────────
const rel1 = reliability(r1);
const rel2 = reliability(r2);
console.log("\n" + "─".repeat(92));
console.log("2. RELIABILITY");
console.log("─".repeat(92));
console.log(`  ${"".padEnd(34)} ${"run1".padStart(10)} ${"run2".padStart(10)}`);
const rl = (k: string, a: number | string, b: number | string) =>
  console.log(`  ${k.padEnd(34)} ${String(a).padStart(10)} ${String(b).padStart(10)}`);
rl("total calls", rel1.totalCalls, rel2.totalCalls);
rl("terminal failures", rel1.failures, rel2.failures);
rl("backoff retry attempts", rel1.retryAttempts, rel2.retryAttempts);
rl("parser calls at max_tokens", rel1.parserAtCap, rel2.parserAtCap);
rl("VALIDATOR calls at max_tokens", rel1.validatorAtCap, rel2.validatorAtCap);
rl("generate calls at max_tokens", rel1.generateAtCap, rel2.generateAtCap);
rl("validator unavailable", rel1.validatorUnavailable, rel2.validatorUnavailable);
rl("JD parse-recovery calls", `n/a`, rel2.parseRecovery);
rl("validator parse-recovery", rel1.validatorRecovery.value, rel2.validatorRecovery.value);
console.log(`     run1 method: ${rel1.validatorRecovery.method}`);
console.log(`     run2 method: ${rel2.validatorRecovery.method}`);
rl("input-validation rejected", rel1.inputRejected, rel2.inputRejected);

// ── 3. Routing deltas ────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(92));
console.log("3. ROUTING COST / LATENCY  (Config A vs Config B, within each run)");
console.log("─".repeat(92));
for (const [label, A, B] of [["run1", A1, B1], ["run2", A2, B2]] as const) {
  const cd = ((B.costPerGen - A.costPerGen) / B.costPerGen) * 100;
  const ld = ((B.latMean - A.latMean) / B.latMean) * 100;
  console.log(
    `  ${label}: A $${f(A.costPerGen)}/gen ${A.latMean.toFixed(0)}ms   B $${f(B.costPerGen)}/gen ${B.latMean.toFixed(0)}ms` +
      `   -> A is ${cd.toFixed(1)}% cheaper, ${ld.toFixed(1)}% faster`
  );
}
console.log("\n  Per-config movement run1 -> run2:");
for (const [name, X1, X2] of [["Config A", A1, A2], ["Config B", B1, B2]] as const) {
  console.log(
    `    ${name}: cost/gen $${f(X1.costPerGen)} -> $${f(X2.costPerGen)} (${pctDelta(X1.costPerGen, X2.costPerGen) >= 0 ? "+" : ""}${pctDelta(X1.costPerGen, X2.costPerGen).toFixed(1)}%)   ` +
      `latency ${X1.latMean.toFixed(0)} -> ${X2.latMean.toFixed(0)}ms (${pctDelta(X1.latMean, X2.latMean) >= 0 ? "+" : ""}${pctDelta(X1.latMean, X2.latMean).toFixed(1)}%)`
  );
}
console.log("\n  Latency percentiles:");
for (const [label, A, B] of [["run1", A1, B1], ["run2", A2, B2]] as const) {
  console.log(`    ${label} A: p50 ${A.latP50} p90 ${A.latP90} p95 ${A.latP95}   B: p50 ${B.latP50} p90 ${B.latP90} p95 ${B.latP95}`);
}
console.log("\n  Per-stage (Config A):");
for (const [label, rows] of [["run1", r1], ["run2", r2]] as const) {
  for (const s of stageTable(rows, "A")) {
    console.log(`    ${label} ${s.stage.padEnd(22)} n=${String(s.n).padStart(3)} $${s.cost.toFixed(4)} out=${String(s.outTok).padStart(7)} ${s.latMean.toFixed(0)}ms`);
  }
}
console.log("\n  Per-stage (Config B):");
for (const [label, rows] of [["run1", r1], ["run2", r2]] as const) {
  for (const s of stageTable(rows, "B")) {
    console.log(`    ${label} ${s.stage.padEnd(22)} n=${String(s.n).padStart(3)} $${s.cost.toFixed(4)} out=${String(s.outTok).padStart(7)} ${s.latMean.toFixed(0)}ms`);
  }
}

// ── 4. Quality, against the noise floor ──────────────────────────────────────
console.log("\n" + "─".repeat(92));
console.log("4. QUALITY  (delta vs within-run noise floor)");
console.log("─".repeat(92));
for (const [name, X1, X2] of [["Config A", A1, A2], ["Config B", B1, B2]] as const) {
  const noiseMean = X1.perRun.length >= 2 ? Math.abs(X1.perRun[0].meanOverall - X1.perRun[1].meanOverall) : NaN;
  const noisePass = X1.perRun.length >= 2 ? Math.abs(X1.perRun[0].passRate - X1.perRun[1].passRate) : NaN;
  const noiseMean2 = X2.perRun.length >= 2 ? Math.abs(X2.perRun[0].meanOverall - X2.perRun[1].meanOverall) : NaN;
  const noisePass2 = X2.perRun.length >= 2 ? Math.abs(X2.perRun[0].passRate - X2.perRun[1].passRate) : NaN;
  const dMean = X2.meanOverall - X1.meanOverall;
  const dPass = X2.passRate - X1.passRate;
  const noiseM = Math.max(noiseMean, noiseMean2);
  const noiseP = Math.max(noisePass, noisePass2);
  console.log(`\n  ${name}`);
  console.log(`    mean overall   ${X1.meanOverall.toFixed(3)} -> ${X2.meanOverall.toFixed(3)}   delta ${dMean >= 0 ? "+" : ""}${dMean.toFixed(3)}`);
  console.log(`      noise floor (max within-run spread): ${noiseM.toFixed(3)}  -> ${Math.abs(dMean) > noiseM ? "EXCEEDS NOISE" : "INSIDE NOISE"}`);
  console.log(`    pass rate      ${pc(X1.passRate)} -> ${pc(X2.passRate)}   delta ${dPass >= 0 ? "+" : ""}${(dPass * 100).toFixed(1)}pp`);
  console.log(`      noise floor: ${(noiseP * 100).toFixed(1)}pp  -> ${Math.abs(dPass) > noiseP ? "EXCEEDS NOISE" : "INSIDE NOISE"}`);
  console.log(`    median         ${X1.medianOverall.toFixed(2)} -> ${X2.medianOverall.toFixed(2)}`);
  console.log(`    retry rate     ${pc(X1.retryRate)} -> ${pc(X2.retryRate)}`);
  console.log(`    flags/gen      ${X1.flagsPerGen.toFixed(2)} -> ${X2.flagsPerGen.toFixed(2)}`);
  console.log(`    unavailable    ${X1.unavailable} -> ${X2.unavailable}`);
  console.log(`    dims run1 ${JSON.stringify(X1.dims)}`);
  console.log(`    dims run2 ${JSON.stringify(X2.dims)}`);
  console.log(`    dist run1 ${JSON.stringify(X1.dist)}`);
  console.log(`    dist run2 ${JSON.stringify(X2.dist)}`);
  console.log(`    per-run run1: ${X1.perRun.map((r) => `r${r.run} mean=${r.meanOverall.toFixed(3)} pass=${pc(r.passRate)}`).join("  ")}`);
  console.log(`    per-run run2: ${X2.perRun.map((r) => `r${r.run} mean=${r.meanOverall.toFixed(3)} pass=${pc(r.passRate)}`).join("  ")}`);
}

// ── 5. Version series ────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(92));
console.log("5. PROMPT-VERSION SERIES");
console.log("─".repeat(92));
for (const [label, rows] of [["run1", r1], ["run2", r2]] as const) {
  const v = versionSeries(rows);
  if (!Object.keys(v).length) { console.log(`  ${label}: none`); continue; }
  for (const [k, s] of Object.entries(v)) {
    console.log(`  ${label} ${k.padEnd(24)} n=${String(s.n).padStart(3)} mean=${s.mean.toFixed(3)} pass=${pc(s.pass)} flags/gen=${s.flags.toFixed(2)}`);
  }
}

console.log("\n" + "=".repeat(92));
