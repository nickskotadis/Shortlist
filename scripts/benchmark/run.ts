#!/usr/bin/env tsx
// ── Shortlist generation-pipeline benchmark ───────────────────────────────────
// Standalone local harness. Not part of the app bundle. Run with:
//   npm run bench -- [flags]
//
// Flags:
//   --preflight        Run preflight checks only, spend nothing, exit.
//   --dry-run          Walk the full matrix with a stubbed client. No API calls.
//   --estimate-only    Run the cost pilot, print the estimate, exit.
//   --fresh            Ignore and overwrite any existing checkpoint.
//   --yes              Skip the interactive cost confirmation.
//   --runs N           Runs per config (default 2).
//   --concurrency N    Parallel pipelines, capped at 3. Default 1 (sequential).
//   --skip-versions    Skip the prompt-version history experiment.
//   --report-only F    Re-aggregate an existing raw JSONL file and exit.

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MODELS, PROMPT_AB_VARIANT, PROMPT_VERSIONS } from "../../lib/constants";
import type { DocumentType, ToneType, UserData, UserType } from "../../lib/types";
import { composition, fixtureSetHash, loadFixtures, seededShuffle, type Fixture } from "./fixtures";
import { Recorder } from "./instrument";
import { runPipeline, type ModelRouting } from "./pipeline";
import { PRICING_FETCHED_AT, PRICING_SOURCE_URL, costUsd, fmtUsd } from "./pricing";
import {
  aggregateConfig,
  aggregateQuality,
  aggregateReliability,
  isEvent,
  loadRows,
  totalSpend,
  type EventRow,
} from "./report";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const JD_DIR = join(HERE, "jds");
const RESULTS_DIR = join(HERE, "results");
const CANDIDATE_PATH = join(HERE, "candidate.txt");

// ── Held constant across the entire matrix ────────────────────────────────────
const DOC_TYPE: DocumentType = "bullets";
const USER_TYPE: UserType = "mid_career";
const TONE: ToneType = "professional";
const USER_DATA: UserData = {
  years_experience: "7",
  current_job_title: "Senior Software Engineer",
  target_job_title: "Senior Software Engineer",
  industry: "Software",
};
const SEED = 20260805;

const CONFIG_A: ModelRouting = {
  label: "A",
  parser: MODELS.parser,
  generator: MODELS.generator,
  validator: MODELS.validator,
};
const CONFIG_B: ModelRouting = {
  label: "B",
  parser: MODELS.generator,
  generator: MODELS.generator,
  validator: MODELS.generator,
};

// ── Args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string, d: string): string => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const OPT = {
  preflight: has("--preflight"),
  dryRun: has("--dry-run"),
  estimateOnly: has("--estimate-only"),
  fresh: has("--fresh"),
  yes: has("--yes"),
  runs: Math.max(1, parseInt(val("--runs", "2"), 10)),
  concurrency: Math.min(3, Math.max(1, parseInt(val("--concurrency", "1"), 10))),
  skipVersions: has("--skip-versions"),
  reportOnly: has("--report-only") ? val("--report-only", "") : null,
};

// ── Env loading (.env.local preferred, else .env) ──────────────────────────────
function loadEnv(): string {
  for (const name of [".env.local", ".env"]) {
    const p = join(REPO, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
    return name;
  }
  return "(none found)";
}

// ── Preflight ─────────────────────────────────────────────────────────────────
interface Preflight {
  envSource: string;
  fixtures: Fixture[];
  hash: string;
}

async function preflight(): Promise<Preflight> {
  console.log("── Phase 0: Preflight ──────────────────────────────────────────\n");

  if (!existsSync(join(REPO, "node_modules"))) {
    console.error("FAIL: node_modules missing. Run `npm install` and retry.");
    process.exit(1);
  }
  console.log("  node_modules ......... present");

  const envSource = loadEnv();
  console.log(`  env source ........... ${envSource}`);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error(`\nFAIL: ANTHROPIC_API_KEY not set (checked .env.local then .env).`);
    process.exit(1);
  }
  console.log(`  ANTHROPIC_API_KEY .... set (${key.length} chars, ${key.slice(0, 14)}…)`);

  if (OPT.dryRun) {
    console.log("  auth check ........... SKIPPED (--dry-run)");
  } else {
    const status = execSync(
      `curl -s -o /dev/null -w "%{http_code}" https://api.anthropic.com/v1/models ` +
        `-H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01"`,
      { env: { ...process.env, ANTHROPIC_API_KEY: key }, encoding: "utf8" }
    ).trim();
    if (status !== "200") {
      console.error(
        `\nFAIL: API key did not authenticate. HTTP ${status} from /v1/models.\n` +
          `This is the known stale-key failure mode: the key in ${envSource} may be\n` +
          `out of date relative to the one production uses. Stopping before spending anything.`
      );
      process.exit(1);
    }
    console.log(`  auth check ........... HTTP ${status} OK`);
  }

  console.log("\n  MODELS:");
  console.log(`    generator .......... ${MODELS.generator}`);
  console.log(`    parser ............. ${MODELS.parser}`);
  console.log(`    validator .......... ${MODELS.validator}`);

  console.log("\n  PROMPT_VERSIONS (pipeline-relevant):");
  for (const k of ["jd_parser", "bullets", "summary", "cover_letter", "validator"] as const) {
    console.log(`    ${k.padEnd(18)} ${PROMPT_VERSIONS[k]}`);
  }
  console.log(`  PROMPT_AB_VARIANT .... ${PROMPT_AB_VARIANT}`);

  if (!existsSync(JD_DIR)) {
    console.error(`\nFAIL: ${JD_DIR} does not exist. See scripts/benchmark/jds/README.md.`);
    process.exit(1);
  }
  const fixtures = loadFixtures(JD_DIR);
  const comp = composition(fixtures);
  const hash = fixtureSetHash(fixtures);

  console.log(`\n  JD fixtures .......... ${comp.count} files (set hash ${hash})`);
  console.log(
    `    chars .............. mean ${comp.meanChars}, min ${comp.minChars}, max ${comp.maxChars}`
  );
  console.log(
    `    words .............. mean ${comp.meanWords}, min ${comp.minWords}, max ${comp.maxWords}`
  );
  console.log(`    eligible ........... ${comp.eligible} (≤15,000 chars)`);
  console.log(`    over cap ........... ${comp.overCap} (rejected by route, 0 API cost)`);
  console.log("    by category:");
  for (const c of comp.byCategory) {
    console.log(
      `      ${c.category.padEnd(11)} n=${String(c.count).padStart(2)}  ` +
        `chars mean ${String(c.meanChars).padStart(6)}  ` +
        `[${c.minChars}–${c.maxChars}]`
    );
  }

  if (comp.count < 10) {
    console.error(
      `\nFAIL: only ${comp.count} JD fixtures found; need at least 10.\n` +
        `Add .txt files to ${JD_DIR} (see its README.md for the naming convention).`
    );
    process.exit(1);
  }

  if (!existsSync(CANDIDATE_PATH)) {
    console.error(`\nFAIL: ${CANDIDATE_PATH} missing.`);
    process.exit(1);
  }
  const cand = readFileSync(CANDIDATE_PATH, "utf8");
  console.log(`\n  candidate resume ..... ${cand.length} chars (held constant)`);
  if (cand.trim().length < 50 || cand.length > 8000) {
    console.error(`FAIL: candidate input must be 50–8,000 chars (route LIMITS).`);
    process.exit(1);
  }

  console.log("\n  Preflight OK.\n");
  return { envSource, fixtures, hash };
}

// ── Checkpointing ─────────────────────────────────────────────────────────────
interface Checkpoint {
  startedAt: string;
  seed: number;
  fixtureSetHash: string;
  rawPath: string;
  outputsPath: string;
  completed: string[];
}
// Dry runs get their own checkpoint and log files so a stubbed walk can never
// be mistaken for real work by a later billable run.
const ckptPath = () =>
  join(RESULTS_DIR, OPT.dryRun ? "checkpoint.dryrun.json" : "checkpoint.json");
const keyOf = (exp: string, jd: string, cfg: string, run: number) => `${exp}|${jd}|${cfg}|${run}`;

function loadCheckpoint(hash: string): Checkpoint | null {
  if (OPT.fresh || !existsSync(ckptPath())) return null;
  const c = JSON.parse(readFileSync(ckptPath(), "utf8")) as Checkpoint;
  if (c.fixtureSetHash !== hash) {
    console.error(
      `\nFAIL: checkpoint was written against fixture set ${c.fixtureSetHash}, but the\n` +
        `current fixture set hashes to ${hash}. The inputs changed. Re-run with --fresh\n` +
        `to start over, or restore the previous fixtures.`
    );
    process.exit(1);
  }
  return c;
}

function saveCheckpoint(c: Checkpoint): void {
  writeFileSync(ckptPath(), JSON.stringify(c, null, 2));
}

// ── Work matrix ───────────────────────────────────────────────────────────────
interface Unit {
  experiment: string;
  fixture: Fixture;
  routing: ModelRouting;
  run: number;
  docType: DocumentType;
  promptVersionLabel?: string;
  docPromptOverride?: RunOptsOverride;
}
type RunOptsOverride = NonNullable<Parameters<typeof runPipeline>[0]["docPromptOverride"]>;

function buildExp1Units(fixtures: Fixture[]): Unit[] {
  const units: Unit[] = [];
  for (const routing of [CONFIG_A, CONFIG_B]) {
    for (let run = 1; run <= OPT.runs; run++) {
      // Randomize JD order per (config, run) so ordering effects and API-side
      // variance do not correlate with config. Seed is deterministic so a
      // checkpoint resume reproduces the same order.
      const seed = SEED + routing.label.charCodeAt(0) * 1000 + run;
      for (const fixture of seededShuffle(fixtures, seed)) {
        units.push({ experiment: "exp1", fixture, routing, run, docType: DOC_TYPE });
      }
    }
  }
  return units;
}

// ── Cost estimation ───────────────────────────────────────────────────────────
async function estimate(fixtures: Fixture[], recorder: Recorder, rand: () => number) {
  console.log("── Phase 3: Cost estimate ──────────────────────────────────────\n");
  console.log(`  Pricing source: ${PRICING_SOURCE_URL}`);
  console.log(`  Fetched:        ${PRICING_FETCHED_AT}\n`);

  const eligible = fixtures.filter((f) => !f.overCap);
  // Pilot on the fixture closest to the mean eligible length.
  const meanChars = eligible.reduce((a, f) => a + f.chars, 0) / eligible.length;
  const pilot = [...eligible].sort(
    (a, b) => Math.abs(a.chars - meanChars) - Math.abs(b.chars - meanChars)
  )[0];
  const candidateInput = readFileSync(CANDIDATE_PATH, "utf8");

  console.log(`  Pilot JD: ${pilot.file} (${pilot.chars} chars, near-mean)\n`);

  // Actual per-config cost is computed from the recorded call rows by the
  // caller; this loop only needs to make the two pilot passes happen.
  for (const routing of [CONFIG_A, CONFIG_B]) {
    const out = await runPipeline({
      fixture: pilot,
      routing,
      run: 0,
      documentType: DOC_TYPE,
      userType: USER_TYPE,
      userData: USER_DATA,
      candidateInput,
      tone: TONE,
      experiment: "pilot",
      recorder,
      rand,
      dryRun: OPT.dryRun,
    });
    console.log(
      `  Config ${routing.label}: ${out.totalInputTokens} in / ${out.totalOutputTokens} out tokens, ` +
        `${out.totalWallMs}ms, retry=${out.retryCount}`
    );
  }
  return { pilot };
}

// ── Execution ─────────────────────────────────────────────────────────────────
async function executeUnits(
  units: Unit[],
  ckpt: Checkpoint,
  recorder: Recorder,
  rand: () => number,
  candidateInput: string
): Promise<void> {
  const done = new Set(ckpt.completed);
  const todo = units.filter(
    (u) => !done.has(keyOf(u.experiment, u.fixture.file, u.routing.label, u.run))
  );

  console.log(
    `  ${units.length} units total, ${units.length - todo.length} already complete, ${todo.length} to run\n`
  );

  let n = 0;
  const total = todo.length;
  const started = Date.now();

  const runOne = async (u: Unit) => {
    const idx = ++n;
    const tag =
      `[${String(idx).padStart(3)}/${total}] ${u.experiment} cfg${u.routing.label} r${u.run} ` +
      `${u.fixture.file.slice(0, 38).padEnd(38)}`;
    try {
      const out = await runPipeline({
        fixture: u.fixture,
        routing: u.routing,
        run: u.run,
        documentType: u.docType,
        userType: USER_TYPE,
        userData: USER_DATA,
        candidateInput,
        tone: TONE,
        experiment: u.experiment,
        recorder,
        rand,
        dryRun: OPT.dryRun,
        docPromptOverride: u.docPromptOverride,
        promptVersionLabel: u.promptVersionLabel,
      });
      if (out.rejected) {
        console.log(`${tag} REJECTED (${out.rejectionReason}, 0 calls)`);
      } else {
        console.log(
          `${tag} ${String(out.totalWallMs).padStart(6)}ms  ` +
            `score ${(out.validator?.overall ?? 0).toFixed(1)}  ` +
            `${out.validator?.verdict ?? "?"}${out.retryCount ? " +retry" : ""}` +
            `${out.validatorUnavailable ? " UNAVAIL" : ""}` +
            `${out.failedCalls ? ` ${out.failedCalls}FAIL` : ""}`
        );
      }
    } catch (err) {
      // A pipeline-level throw must not abort the run.
      console.log(`${tag} PIPELINE ERROR: ${(err as Error).message}`);
      recorder.event({
        experiment: u.experiment,
        jd_file: u.fixture.file,
        jd_category: u.fixture.category,
        jd_chars: u.fixture.chars,
        config: u.routing.label,
        run: u.run,
        doc_type: u.docType,
        outcome: "pipeline_error",
        reason: (err as Error).message,
        ts: new Date().toISOString(),
      });
    }
    ckpt.completed.push(keyOf(u.experiment, u.fixture.file, u.routing.label, u.run));
    saveCheckpoint(ckpt);
  };

  if (OPT.concurrency === 1) {
    for (const u of todo) await runOne(u);
  } else {
    console.log(
      `  WARNING: concurrency=${OPT.concurrency}. Parallel calls distort latency ` +
        `measurements; this is stamped into the results.\n`
    );
    const queue = [...todo];
    const workers = Array.from({ length: OPT.concurrency }, async () => {
      while (queue.length) {
        const u = queue.shift();
        if (u) await runOne(u);
      }
    });
    await Promise.all(workers);
  }

  const elapsed = Math.round((Date.now() - started) / 1000);
  console.log(`\n  Completed ${total} units in ${elapsed}s\n`);
}

// ── Prompt-version experiment ─────────────────────────────────────────────────
interface VersionSpec {
  version: string;
  commit: string;
}

function discoverPromptVersions(): VersionSpec[] {
  // bullets-v1 / v2 / v3 are recoverable from history; the commit that introduced
  // each version string is found by walking `git log` for lib/constants.ts.
  const out: VersionSpec[] = [];
  try {
    const log = execSync(`git log --format=%H --reverse -- lib/constants.ts`, {
      cwd: REPO,
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);

    const seen = new Set<string>();
    for (const commit of log) {
      let constants: string;
      try {
        constants = execSync(`git show ${commit}:lib/constants.ts`, { cwd: REPO, encoding: "utf8" });
      } catch {
        continue;
      }
      const m = constants.match(/bullets:\s*"([^"]+)"/);
      if (!m) continue;
      const v = m[1];
      if (seen.has(v)) continue;
      // Verify lib/prompts.ts exists at this commit and exports buildBulletsPrompt.
      try {
        const prompts = execSync(`git show ${commit}:lib/prompts.ts`, { cwd: REPO, encoding: "utf8" });
        if (!prompts.includes("buildBulletsPrompt")) continue;
      } catch {
        continue;
      }
      seen.add(v);
      out.push({ version: v, commit });
    }
  } catch {
    return [];
  }
  return out;
}

async function loadHistoricalBuilder(spec: VersionSpec): Promise<RunOptsOverride | null> {
  const dir = join(HERE, "versions");
  mkdirSync(dir, { recursive: true });
  const stem = `prompts-${spec.version}`;
  const promptsPath = join(dir, `${stem}.ts`);
  const typesPath = join(dir, `types-${spec.version}.ts`);
  const constantsPath = join(dir, `constants-${spec.version}.ts`);

  try {
    if (!existsSync(promptsPath)) {
      const src = execSync(`git show ${spec.commit}:lib/prompts.ts`, { cwd: REPO, encoding: "utf8" });
      writeFileSync(promptsPath, src);
      writeFileSync(
        typesPath,
        execSync(`git show ${spec.commit}:lib/types.ts`, { cwd: REPO, encoding: "utf8" })
      );
      writeFileSync(
        constantsPath,
        execSync(`git show ${spec.commit}:lib/constants.ts`, { cwd: REPO, encoding: "utf8" })
      );
      // Historical prompts.ts imports "./types" and "./constants"; the sibling
      // files we just wrote are version-suffixed, so rewrite those specifiers.
      writeFileSync(
        promptsPath,
        src
          .replace(/from\s+"\.\/types"/g, `from "./types-${spec.version}"`)
          .replace(/from\s+"\.\/constants"/g, `from "./constants-${spec.version}"`)
      );
    }
    const mod = (await import(promptsPath)) as {
      buildBulletsPrompt?: (
        userTypeBlock: string,
        jd: unknown,
        candidate: string,
        tone?: ToneType
      ) => string;
    };
    if (typeof mod.buildBulletsPrompt !== "function") return null;
    const fn = mod.buildBulletsPrompt;
    return ({ userTypeBlock, jdAnalysis, candidateInput, tone }) =>
      fn(userTypeBlock, jdAnalysis, candidateInput, tone);
  } catch (err) {
    console.log(`    could not load ${spec.version}: ${(err as Error).message}`);
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (OPT.reportOnly) {
    const rows = loadRows(OPT.reportOnly);
    printSummary(rows);
    return;
  }

  const pf = await preflight();
  if (OPT.preflight) return;

  mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  let ckpt = loadCheckpoint(pf.hash);
  if (!ckpt) {
    ckpt = {
      startedAt: new Date().toISOString(),
      seed: SEED,
      fixtureSetHash: pf.hash,
      rawPath: join(RESULTS_DIR, `${OPT.dryRun ? "dryrun" : "raw"}-${stamp}.jsonl`),
      outputsPath: join(RESULTS_DIR, `${OPT.dryRun ? "dryrun-outputs" : "outputs"}-${stamp}.jsonl`),
      completed: [],
    };
    saveCheckpoint(ckpt);
    console.log(`  New run. Raw log: ${ckpt.rawPath}\n`);
  } else {
    console.log(
      `  Resuming checkpoint from ${ckpt.startedAt} (${ckpt.completed.length} units done)\n` +
        `  Raw log: ${ckpt.rawPath}\n`
    );
  }

  const recorder = new Recorder(ckpt.rawPath, ckpt.outputsPath);
  const rand = Math.random; // jitter only; not used for anything reproducible
  const candidateInput = readFileSync(CANDIDATE_PATH, "utf8");

  try {
    // ── Phase 3: pilot + estimate + confirm ─────────────────────────────────
    const eligible = pf.fixtures.filter((f) => !f.overCap);
    const exp1Units = buildExp1Units(pf.fixtures);

    if (ckpt.completed.length === 0) {
      await estimate(pf.fixtures, recorder, rand);

      const pilotRows = loadRows(ckpt.rawPath).filter(
        (r) => "experiment" in r && r.experiment === "pilot"
      );
      const pilotCost: Record<string, number> = {};
      for (const r of pilotRows) {
        if (r.kind === "event") continue;
        if (!r.ok) continue;
        pilotCost[r.config] =
          (pilotCost[r.config] ?? 0) + costUsd(r.model, r.input_tokens ?? 0, r.output_tokens ?? 0);
      }

      // Scale the pilot by the real fixture length distribution: input tokens
      // scale roughly with JD length in the parse and validate stages.
      const meanChars = eligible.reduce((a, f) => a + f.chars, 0) / eligible.length;
      const pilotChars =
        [...eligible].sort(
          (a, b) => Math.abs(a.chars - meanChars) - Math.abs(b.chars - meanChars)
        )[0].chars;
      const lengthFactor =
        eligible.reduce((a, f) => a + f.chars, 0) / (eligible.length * pilotChars);

      const perGenA = (pilotCost["A"] ?? 0) * lengthFactor;
      const perGenB = (pilotCost["B"] ?? 0) * lengthFactor;
      const exp1Cost = (perGenA + perGenB) * eligible.length * OPT.runs;

      const versions = OPT.skipVersions ? [] : discoverPromptVersions();
      const priorVersions = versions.filter((v) => v.version !== PROMPT_VERSIONS.bullets);
      const versionCost = perGenA * eligible.length * priorVersions.length;

      const grand = exp1Cost + versionCost + (pilotCost["A"] ?? 0) + (pilotCost["B"] ?? 0);

      console.log("\n  ── Extrapolated cost for the full matrix ─────────────────\n");
      console.log(`    Eligible JDs:            ${eligible.length}`);
      console.log(`    Over-cap JDs (0 cost):   ${pf.fixtures.length - eligible.length}`);
      console.log(`    Runs per config:         ${OPT.runs}`);
      console.log(`    Pilot cost A / B:        ${fmtUsd(pilotCost["A"] ?? 0)} / ${fmtUsd(pilotCost["B"] ?? 0)}`);
      console.log(`    Length-scaling factor:   ${lengthFactor.toFixed(3)}`);
      console.log(`    Est. per generation A:   ${fmtUsd(perGenA)}`);
      console.log(`    Est. per generation B:   ${fmtUsd(perGenB)}`);
      console.log(`\n    Experiment 1 (A+B × ${OPT.runs} runs × ${eligible.length} JDs): ${fmtUsd(exp1Cost)}`);
      console.log(
        `    Prompt-version series (${priorVersions.length} prior versions × ${eligible.length} JDs): ${fmtUsd(versionCost)}`
      );
      console.log(`\n    ESTIMATED TOTAL:         ${fmtUsd(grand)}`);
      console.log(
        `\n    Note: retries are included only to the extent the pilot happened to\n` +
          `    retry. If the pilot did not retry and the corpus does, actual spend\n` +
          `    will exceed this estimate by up to roughly 60%.\n`
      );

      if (OPT.estimateOnly) {
        recorder.close();
        return;
      }
      if (!OPT.yes && !OPT.dryRun) {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const ans = (await rl.question("  Proceed with the billable run? [y/N] ")).trim().toLowerCase();
        rl.close();
        if (ans !== "y" && ans !== "yes") {
          console.log("\n  Aborted. Nothing further was spent.");
          recorder.close();
          return;
        }
        console.log("");
      }
    }

    // ── Phase 4: Experiment 1 ────────────────────────────────────────────────
    console.log("── Phase 4: Experiment 1 — routing cost & latency ──────────────\n");
    await executeUnits(exp1Units, ckpt, recorder, rand, candidateInput);

    // ── Phase 5b: prompt-version series ──────────────────────────────────────
    if (!OPT.skipVersions) {
      console.log("── Phase 5: Prompt-version history series ──────────────────────\n");
      const versions = discoverPromptVersions();
      const prior = versions.filter((v) => v.version !== PROMPT_VERSIONS.bullets);
      if (!prior.length) {
        console.log("  No prior bullets prompt versions recoverable from git history.\n");
      } else {
        console.log(`  Recoverable prior versions: ${prior.map((v) => v.version).join(", ")}\n`);
        for (const spec of prior) {
          const builder = await loadHistoricalBuilder(spec);
          if (!builder) {
            console.log(`  ${spec.version}: NOT LOADABLE — skipping (reported as such)\n`);
            continue;
          }
          const units: Unit[] = seededShuffle(pf.fixtures, SEED + 7).map((fixture) => ({
            experiment: `version:${spec.version}`,
            fixture,
            routing: CONFIG_A,
            run: 1,
            docType: DOC_TYPE,
            promptVersionLabel: spec.version,
            docPromptOverride: builder,
          }));
          console.log(`  Running ${spec.version} (commit ${spec.commit.slice(0, 8)})`);
          await executeUnits(units, ckpt, recorder, rand, candidateInput);
        }
      }
    }
  } finally {
    recorder.close();
  }

  const rows = loadRows(ckpt.rawPath);
  printSummary(rows);
  writeFileSync(
    join(RESULTS_DIR, "summary.json"),
    JSON.stringify(buildSummary(rows), null, 2)
  );
  console.log(`  summary.json written to ${RESULTS_DIR}\n`);
}

// ── Summary output ────────────────────────────────────────────────────────────
function buildSummary(rows: ReturnType<typeof loadRows>) {
  const events = rows.filter(isEvent) as EventRow[];
  const completed = events.filter((e) => e.outcome === "completed");
  const versions = [
    ...new Set(completed.map((e) => e.experiment).filter((x) => x.startsWith("version:"))),
  ].sort();

  return {
    generatedAt: new Date().toISOString(),
    pricing: { source: PRICING_SOURCE_URL, fetched: PRICING_FETCHED_AT },
    models: MODELS,
    promptVersions: PROMPT_VERSIONS,
    abVariant: PROMPT_AB_VARIANT,
    concurrency: OPT.concurrency,
    runsPerConfig: OPT.runs,
    totalSpendUsd: totalSpend(rows),
    experiment1: {
      A: aggregateConfig(rows, "exp1", "A"),
      B: aggregateConfig(rows, "exp1", "B"),
    },
    experiment2: {
      current: aggregateQuality(
        completed.filter((e) => e.experiment === "exp1" && e.config === "A"),
        PROMPT_VERSIONS.bullets
      ),
      // Historical versions run once; the current version runs twice. This
      // slice restricts the current version to run 1 so the version series is
      // an equal-n comparison.
      currentRun1: aggregateQuality(
        completed.filter((e) => e.experiment === "exp1" && e.config === "A" && e.run === 1),
        `${PROMPT_VERSIONS.bullets} (run 1 only)`
      ),
      byVersion: Object.fromEntries(
        versions.map((v) => [
          v.replace("version:", ""),
          aggregateQuality(
            completed.filter((e) => e.experiment === v),
            v.replace("version:", "")
          ),
        ])
      ),
    },
    experiment3: aggregateReliability(rows),
  };
}

function printSummary(rows: ReturnType<typeof loadRows>) {
  const s = buildSummary(rows);
  const { A, B } = s.experiment1;

  console.log("\n══ RESULTS ═════════════════════════════════════════════════════\n");
  if (OPT.dryRun) {
    console.log(
      `  *** DRY RUN — no API calls were made. Every number below is derived from\n` +
        `      synthetic stub responses and is meaningless except as a check that the\n` +
        `      harness plumbing works. Nominal cost of the stubs: ${fmtUsd(s.totalSpendUsd)} ***\n`
    );
  } else {
    console.log(`  Actual total spend: ${fmtUsd(s.totalSpendUsd)}\n`);
  }

  console.log("  Experiment 1 — routing cost & latency");
  console.log(`    ${"".padEnd(28)} ${"Config A".padStart(12)} ${"Config B".padStart(12)}`);
  const line = (label: string, a: string, b: string) =>
    console.log(`    ${label.padEnd(28)} ${a.padStart(12)} ${b.padStart(12)}`);
  line("generations", String(A.generations), String(B.generations));
  line("input tokens", A.inputTokens.toLocaleString(), B.inputTokens.toLocaleString());
  line("output tokens", A.outputTokens.toLocaleString(), B.outputTokens.toLocaleString());
  line("total cost", fmtUsd(A.totalCostUsd), fmtUsd(B.totalCostUsd));
  line("mean cost / generation", fmtUsd(A.meanCostPerGeneration), fmtUsd(B.meanCostPerGeneration));
  line("latency mean (ms)", String(A.latency.mean), String(B.latency.mean));
  line("latency p50 (ms)", String(A.latency.p50), String(B.latency.p50));
  line("latency p90 (ms)", String(A.latency.p90), String(B.latency.p90));
  line("latency p95 (ms)", String(A.latency.p95), String(B.latency.p95));

  if (A.meanCostPerGeneration && B.meanCostPerGeneration) {
    const costDelta =
      (B.meanCostPerGeneration - A.meanCostPerGeneration) / B.meanCostPerGeneration;
    const latDelta = (B.latency.mean - A.latency.mean) / B.latency.mean;
    console.log(`\n    Config A is ${(costDelta * 100).toFixed(1)}% cheaper than Config B`);
    console.log(`    Config A is ${(latDelta * 100).toFixed(1)}% faster than Config B`);
    console.log(
      `\n    Between-run spread — A: cost ${(A.betweenRunCostSpread * 100).toFixed(1)}%, ` +
        `latency ${(A.betweenRunLatencySpread * 100).toFixed(1)}%`
    );
    console.log(
      `                         B: cost ${(B.betweenRunCostSpread * 100).toFixed(1)}%, ` +
        `latency ${(B.betweenRunLatencySpread * 100).toFixed(1)}%`
    );
    if (A.unstable || B.unstable) {
      console.log(
        `\n    *** UNSTABLE: at least one config's two runs disagree by >10%.\n` +
          `        Treat the deltas above as unstable. ***`
      );
    }
  }

  const q = s.experiment2.current;
  console.log(`\n  Experiment 2 — validator quality (${q.label}, Config A, n=${q.n})`);
  console.log(`    mean overall ....... ${q.meanOverall}`);
  console.log(`    median overall ..... ${q.medianOverall}`);
  console.log(
    `    pass rate .......... ${(q.passRate * 100).toFixed(1)}% ` +
      `(PASS ${q.passCount} / REVISE ${q.reviseCount} / REJECT ${q.rejectCount} / UNAVAIL ${q.unavailableCount})`
  );
  console.log(`    retry rate ......... ${(q.retryRate * 100).toFixed(1)}%`);
  console.log(`    flags / generation . ${q.meanFlagsPerGeneration}`);
  console.log(`    distribution ....... ${JSON.stringify(q.distribution)}`);
  console.log(`    mean dimensions .... ${JSON.stringify(q.meanDimensions)}`);
  if (q.totalFlags) console.log(`    flags by type ...... ${JSON.stringify(q.flagsByType)}`);

  const versionKeys = Object.keys(s.experiment2.byVersion);
  if (versionKeys.length) {
    const r1 = s.experiment2.currentRun1;
    console.log(`\n    Pass rate over prompt versions (equal n, Config A, run 1):`);
    for (const [v, agg] of Object.entries(s.experiment2.byVersion)) {
      console.log(
        `      ${v.padEnd(14)} n=${String(agg.n).padStart(3)}  ` +
          `mean ${agg.meanOverall.toFixed(2)}  pass ${(agg.passRate * 100).toFixed(1)}%  ` +
          `flags/gen ${agg.meanFlagsPerGeneration}`
      );
    }
    console.log(
      `      ${PROMPT_VERSIONS.bullets.padEnd(14)} n=${String(r1.n).padStart(3)}  ` +
        `mean ${r1.meanOverall.toFixed(2)}  pass ${(r1.passRate * 100).toFixed(1)}%  ` +
        `flags/gen ${r1.meanFlagsPerGeneration}  (current)`
    );
  }

  const r = s.experiment3;
  console.log(`\n  Experiment 3 — reliability`);
  console.log(`    total calls ................. ${r.totalCalls}`);
  console.log(`    failed calls (terminal) ..... ${r.failedCalls}`);
  console.log(`    retry attempts .............. ${r.retryAttempts}`);
  console.log(`    exhausted all retries ....... ${r.exhaustedRetries}`);
  console.log(`    failures by type ............ ${JSON.stringify(r.failuresByType)}`);
  console.log(`    JD parse ok ................. ${r.jdParseOkCount}/${r.jdParseTotal}`);
  console.log(`    JD parse failures ........... ${JSON.stringify(r.jdParseFailures)}`);
  console.log(`    empty jd_analysis ........... ${r.emptyJdAnalysis}`);
  console.log(`    validator parse retries ..... ${r.validatorParseRetries}`);
  console.log(`    validator first-parse fails . ${JSON.stringify(r.validatorFirstParseFailures)}`);
  console.log(`    validator unavailable ....... ${r.validatorUnavailable}`);
  console.log(`    generate hit max_tokens ..... ${r.generateTruncated}`);
  console.log(`    input-validation rejected ... ${r.inputValidationRejected}`);
  console.log("");
}

main().catch((err) => {
  console.error("\nFATAL:", err);
  process.exit(1);
});
