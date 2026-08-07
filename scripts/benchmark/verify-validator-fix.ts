#!/usr/bin/env tsx
// Verification for the MAX_TOKENS.validator fix, mirroring the method used for
// the parser (scripts/benchmark/verify-parser-fix.ts): run the real validator
// over realistic inputs via live API calls and measure how often it truncates.
//
// "Realistic inputs" here means the actual generated documents produced during
// the benchmark run, replayed from results/outputs-*.jsonl, together with a
// freshly parsed JD analysis. Validator output length scales with how many
// issues it finds, so replaying real outputs (rather than synthesising them)
// is what makes the token-requirement measurement meaningful.
//
//   npx tsx scripts/benchmark/verify-validator-fix.ts [outputsFile]

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MODELS } from "../../lib/constants";
import { parseJson, parseLlmJson } from "../../lib/llm-json";
import { MAX_TOKENS } from "../../lib/pipeline";
import { buildJdParserPrompt, buildValidatorPrompt, resolveVerdict } from "../../lib/prompts";
import type { DocumentType, JdAnalysis, UserType, ValidatorResult } from "../../lib/types";
import { loadFixtures } from "./fixtures";
import { getAnthropic } from "./instrument";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const RESULTS = join(HERE, "results");

for (const name of [".env.local", ".env"]) {
  const p = join(REPO, name);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  break;
}

const IN_RATE = 1.0 / 1_000_000;
const OUT_RATE = 5.0 / 1_000_000;
const USER_TYPE: UserType = "mid_career";
const DOC_TYPE: DocumentType = "bullets";

interface OutputRecord {
  experiment: string;
  config: string;
  run: number;
  jd_file: string;
  output: string;
  validator: ValidatorResult;
}

async function main() {
  const file =
    process.argv[2] ??
    join(
      RESULTS,
      readdirSync(RESULTS)
        .filter((f) => f.startsWith("outputs-") && f.endsWith(".jsonl"))
        .sort()
        .pop()!
    );

  const all = readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as OutputRecord);

  // Config A exp1 only: the production routing, one validation per stored
  // generation, so the sample matches what production actually runs.
  const records = all.filter((r) => r.experiment === "exp1" && r.config === "A" && r.output);
  const candidateInput = readFileSync(join(HERE, "candidate.txt"), "utf8");
  const fixtures = new Map(loadFixtures(join(HERE, "jds")).map((f) => [f.file, f]));

  console.log(
    `Validator verification — cap ${MAX_TOKENS.validator}, ${MODELS.validator}\n` +
      `Replaying ${records.length} generated outputs from ${file.split("/").pop()}\n`
  );

  // Parse each unique JD once and reuse, so the cost sits in the validator.
  const jdFiles = [...new Set(records.map((r) => r.jd_file))];
  console.log(`Parsing ${jdFiles.length} unique JDs (cap ${MAX_TOKENS.parser})...`);
  const analyses = new Map<string, Partial<JdAnalysis>>();
  let parseCost = 0;
  for (const jf of jdFiles) {
    const fx = fixtures.get(jf);
    if (!fx) continue;
    const parsed = await parseLlmJson<Partial<JdAnalysis>>(async () => {
      const r = await getAnthropic().messages.create({
        model: MODELS.parser,
        max_tokens: MAX_TOKENS.parser,
        messages: [{ role: "user", content: buildJdParserPrompt(fx.text) }],
      });
      parseCost += r.usage.input_tokens * IN_RATE + r.usage.output_tokens * OUT_RATE;
      return r.content[0]?.type === "text" ? r.content[0].text : "";
    });
    analyses.set(jf, parsed.ok ? parsed.value : {});
  }
  console.log(`  done ($${parseCost.toFixed(4)})\n`);

  interface Row {
    jd: string;
    attempts: number;
    firstOk: boolean;
    finalOk: boolean;
    outTok: number;
    inTok: number;
    hitCap: boolean;
    wouldTruncateAt1024: boolean;
    issues: number;
    ms: number;
    firstFailReason: string | null;
  }
  const rows: Row[] = [];

  for (const rec of records) {
    const jd = analyses.get(rec.jd_file) ?? {};
    let attempts = 0;
    let firstOk = true;
    let firstFail: string | null = null;
    let inTok = 0;
    let outTok = 0;
    let hitCap = false;
    let maxSingle = 0;
    const t0 = Date.now();

    const parsed = await parseLlmJson<ValidatorResult>(async () => {
      attempts++;
      const resp = await getAnthropic().messages.create({
        model: MODELS.validator,
        max_tokens: MAX_TOKENS.validator,
        messages: [
          {
            role: "user",
            content: buildValidatorPrompt(DOC_TYPE, jd, rec.output, USER_TYPE, candidateInput),
          },
        ],
      });
      inTok += resp.usage.input_tokens;
      outTok += resp.usage.output_tokens;
      maxSingle = Math.max(maxSingle, resp.usage.output_tokens);
      if (resp.stop_reason === "max_tokens") hitCap = true;
      const raw = resp.content[0]?.type === "text" ? resp.content[0].text : "";
      if (attempts === 1) {
        const probe = parseJson<ValidatorResult>(raw);
        firstOk = probe.ok;
        if (!probe.ok) firstFail = probe.reason;
      }
      return raw;
    });

    if (parsed.ok) parsed.value.verdict = resolveVerdict(parsed.value);

    rows.push({
      jd: rec.jd_file,
      attempts,
      firstOk,
      finalOk: parsed.ok,
      outTok,
      inTok,
      hitCap,
      wouldTruncateAt1024: maxSingle > 1024,
      issues: parsed.ok ? (parsed.value.issues ?? []).length : 0,
      ms: Date.now() - t0,
      firstFailReason: firstFail,
    });

    if (!firstOk) {
      console.log(
        `  ${rec.jd_file.slice(0, 40).padEnd(40)} first attempt FAILED (${firstFail}) -> ` +
          `${parsed.ok ? "RECOVERED" : "ALSO FAILED"}`
      );
    }
  }

  const n = rows.length;
  const firstOk = rows.filter((r) => r.firstOk).length;
  const finalOk = rows.filter((r) => r.finalOk).length;
  const outs = rows.map((r) => r.outTok).sort((a, b) => a - b);

  console.log("\n" + "=".repeat(78));
  console.log(`validations:                    ${n}`);
  console.log(`first-attempt parse success:    ${firstOk}/${n} (${((100 * firstOk) / n).toFixed(1)}%)`);
  console.log(`FINAL success (with retry):     ${finalOk}/${n} (${((100 * finalOk) / n).toFixed(1)}%)`);
  console.log(`retries fired:                  ${rows.filter((r) => r.attempts > 1).length}`);
  console.log(`validation ended unavailable:   ${n - finalOk}`);
  console.log(
    `\nhit the NEW cap (${MAX_TOKENS.validator}):        ${rows.filter((r) => r.hitCap).length}`
  );
  console.log(
    `would have hit the OLD cap (1024): ${rows.filter((r) => r.wouldTruncateAt1024).length} ` +
      `(${((100 * rows.filter((r) => r.wouldTruncateAt1024).length) / n).toFixed(1)}%)`
  );
  console.log(
    `\noutput tokens: min ${outs[0]}  median ${outs[Math.floor(n / 2)]}  ` +
      `p90 ${outs[Math.floor(n * 0.9)]}  max ${outs[n - 1]}`
  );
  const byIssues = rows.filter((r) => r.finalOk);
  if (byIssues.length) {
    const maxIssueRow = byIssues.reduce((a, b) => (b.issues > a.issues ? b : a));
    console.log(
      `most-flagged validation: ${maxIssueRow.issues} issues -> ${maxIssueRow.outTok} output tokens`
    );
  }

  const cost = rows.reduce((a, r) => a + r.inTok * IN_RATE + r.outTok * OUT_RATE, 0);
  console.log(
    `\nvalidator cost: $${cost.toFixed(4)} over ${n} validations ($${(cost / n).toFixed(5)} each)`
  );
  console.log(`mean validation latency: ${(rows.reduce((a, r) => a + r.ms, 0) / n).toFixed(0)}ms`);
  console.log(`\ntotal spend this script: $${(cost + parseCost).toFixed(4)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
