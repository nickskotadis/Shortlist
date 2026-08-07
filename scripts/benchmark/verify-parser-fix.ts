#!/usr/bin/env tsx
// Verification for the JD-parser fixes: the raised token cap and the added
// parse retry. Runs the real parser (imported prompt, imported cap, imported
// parseLlmJson) over every eligible fixture and reports:
//
//   - first-attempt parse success  (what the cap fix alone achieves)
//   - final parse success          (what the cap fix + retry achieve)
//   - the cost and latency the retry adds
//
//   npx tsx scripts/benchmark/verify-parser-fix.ts [passes]

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MODELS } from "../../lib/constants";
import { parseJson, parseLlmJson } from "../../lib/llm-json";
import { MAX_TOKENS } from "../../lib/pipeline";
import { buildJdParserPrompt } from "../../lib/prompts";
import type { JdAnalysis } from "../../lib/types";
import { loadFixtures } from "./fixtures";
import { getAnthropic } from "./instrument";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");

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
const PASSES = Math.max(1, parseInt(process.argv[2] ?? "2", 10));

interface Row {
  file: string;
  cat: string;
  attempts: number;
  firstOk: boolean;
  finalOk: boolean;
  keys: number;
  inTok: number;
  outTok: number;
  ms: number;
  hitCap: boolean;
}

async function main() {
  const fixtures = loadFixtures(join(HERE, "jds")).filter((f) => !f.overCap);
  console.log(
    `JD parser verification — cap ${MAX_TOKENS.parser}, retry via parseLlmJson, ` +
      `${MODELS.parser}\n${fixtures.length} fixtures x ${PASSES} passes = ${fixtures.length * PASSES} parses\n`
  );

  const rows: Row[] = [];

  for (let pass = 1; pass <= PASSES; pass++) {
    for (const f of fixtures) {
      let attempts = 0;
      let firstOk = true;
      let inTok = 0;
      let outTok = 0;
      let hitCap = false;
      const t0 = Date.now();

      const parsed = await parseLlmJson<Partial<JdAnalysis>>(async () => {
        attempts++;
        const resp = await getAnthropic().messages.create({
          model: MODELS.parser,
          max_tokens: MAX_TOKENS.parser,
          messages: [{ role: "user", content: buildJdParserPrompt(f.text) }],
        });
        inTok += resp.usage.input_tokens;
        outTok += resp.usage.output_tokens;
        if (resp.stop_reason === "max_tokens") hitCap = true;
        const raw = resp.content[0]?.type === "text" ? resp.content[0].text : "";
        if (attempts === 1) firstOk = parseJson<Partial<JdAnalysis>>(raw).ok;
        return raw;
      });

      rows.push({
        file: f.file,
        cat: f.category,
        attempts,
        firstOk,
        finalOk: parsed.ok,
        keys: parsed.ok ? Object.keys(parsed.value).length : 0,
        inTok,
        outTok,
        ms: Date.now() - t0,
        hitCap,
      });

      if (!firstOk) {
        console.log(
          `  pass${pass} ${f.file.slice(0, 40).padEnd(40)} first attempt FAILED -> ` +
            `retry ${parsed.ok ? "RECOVERED" : "ALSO FAILED"}`
        );
      }
    }
    console.log(`  pass ${pass}/${PASSES} done`);
  }

  const n = rows.length;
  const firstOk = rows.filter((r) => r.firstOk).length;
  const finalOk = rows.filter((r) => r.finalOk).length;
  const retried = rows.filter((r) => r.attempts > 1).length;
  const recovered = rows.filter((r) => !r.firstOk && r.finalOk).length;

  console.log("\n" + "=".repeat(78));
  console.log(`parses:                       ${n}`);
  console.log(`first-attempt success:        ${firstOk}/${n} (${((100 * firstOk) / n).toFixed(1)}%)`);
  console.log(`FINAL success (with retry):   ${finalOk}/${n} (${((100 * finalOk) / n).toFixed(1)}%)`);
  console.log(`retries fired:                ${retried} (${((100 * retried) / n).toFixed(1)}%)`);
  console.log(`recovered by retry:           ${recovered}/${retried}`);
  console.log(`still empty {} after retry:   ${n - finalOk} (${((100 * (n - finalOk)) / n).toFixed(1)}%)`);
  console.log(`hit token cap (${MAX_TOKENS.parser}):        ${rows.filter((r) => r.hitCap).length}`);

  for (const [label, rs] of [
    ["standard", rows.filter((r) => r.cat !== "long")],
    ["long", rows.filter((r) => r.cat === "long")],
  ] as const) {
    if (!rs.length) continue;
    console.log(
      `  ${label.padEnd(9)} n=${String(rs.length).padStart(3)}  ` +
        `first ${((100 * rs.filter((r) => r.firstOk).length) / rs.length).toFixed(0)}%  ` +
        `final ${((100 * rs.filter((r) => r.finalOk).length) / rs.length).toFixed(0)}%`
    );
  }

  const cost = rows.reduce((a, r) => a + r.inTok * IN_RATE + r.outTok * OUT_RATE, 0);
  const retryCost = rows
    .filter((r) => r.attempts > 1)
    .reduce((a, r) => a + (r.inTok * IN_RATE + r.outTok * OUT_RATE) / 2, 0);
  const meanMs = rows.reduce((a, r) => a + r.ms, 0) / n;
  const retryMs = rows.filter((r) => r.attempts > 1);
  console.log(
    `\nparse-stage cost: $${cost.toFixed(4)} over ${n} parses ` +
      `($${(cost / n).toFixed(5)}/parse); retry share $${retryCost.toFixed(4)} ` +
      `(${((100 * retryCost) / cost).toFixed(1)}%)`
  );
  console.log(
    `mean parse latency: ${meanMs.toFixed(0)}ms` +
      (retryMs.length
        ? `  (retried parses: ${(retryMs.reduce((a, r) => a + r.ms, 0) / retryMs.length).toFixed(0)}ms)`
        : "")
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
