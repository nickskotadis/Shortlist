#!/usr/bin/env tsx
// Verification for the MAX_TOKENS.parser fix.
//
// Runs the real JD parser (imported prompt, imported parser, imported cap) over
// every eligible fixture and reports parse success by length bucket, plus the
// cost delta the change introduces.
//
//   npx tsx scripts/benchmark/verify-parser-fix.ts

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MODELS } from "../../lib/constants";
import { parseJson } from "../../lib/llm-json";
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

const HAIKU_IN = 1.0 / 1_000_000;
const HAIKU_OUT = 5.0 / 1_000_000;

async function main() {
  const fixtures = loadFixtures(join(HERE, "jds")).filter((f) => !f.overCap);
  console.log(`Verifying MAX_TOKENS.parser = ${MAX_TOKENS.parser} over ${fixtures.length} eligible fixtures`);
  console.log(`Model: ${MODELS.parser}\n`);
  console.log("fixture                                   chars   out_tok  stop        keys  parse");
  console.log("-".repeat(88));

  const rows: {
    cat: string;
    out: number;
    ok: boolean;
    keys: number;
    truncatedAtOldCap: boolean;
    inTok: number;
  }[] = [];

  for (const f of fixtures) {
    const resp = await getAnthropic().messages.create({
      model: MODELS.parser,
      max_tokens: MAX_TOKENS.parser,
      messages: [{ role: "user", content: buildJdParserPrompt(f.text) }],
    });
    const raw = resp.content[0]?.type === "text" ? resp.content[0].text : "";
    const parsed = parseJson<Partial<JdAnalysis>>(raw);
    const keys = parsed.ok ? Object.keys(parsed.value).length : 0;
    rows.push({
      cat: f.category,
      out: resp.usage.output_tokens,
      ok: parsed.ok,
      keys,
      truncatedAtOldCap: resp.usage.output_tokens > 1024,
      inTok: resp.usage.input_tokens,
    });
    console.log(
      `${f.file.slice(0, 40).padEnd(40)} ${String(f.chars).padStart(6)}  ${String(
        resp.usage.output_tokens
      ).padStart(7)}  ${(resp.stop_reason ?? "?").padEnd(10)}  ${String(keys).padStart(4)}  ${
        parsed.ok ? "OK" : "FAIL:" + (parsed as { reason: string }).reason
      }`
    );
  }

  console.log("\n" + "=".repeat(88));
  const bucket = (isLong: boolean) => rows.filter((r) => (r.cat === "long") === isLong);
  for (const [label, rs] of [
    ["standard", bucket(false)],
    ["long", bucket(true)],
    ["ALL", rows],
  ] as const) {
    if (!rs.length) continue;
    const ok = rs.filter((r) => r.ok).length;
    console.log(
      `${label.padEnd(9)} n=${String(rs.length).padStart(2)}  parse_ok=${ok}/${rs.length} ` +
        `(${((100 * ok) / rs.length).toFixed(0)}%)  ` +
        `out_tok max=${Math.max(...rs.map((r) => r.out))}  ` +
        `would-have-truncated-at-1024: ${rs.filter((r) => r.truncatedAtOldCap).length}`
    );
  }
  console.log(`\nhit new cap (${MAX_TOKENS.parser}): ${rows.filter((r) => r.out >= MAX_TOKENS.parser).length}`);
  const emptyAnalyses = rows.filter((r) => r.keys === 0).length;
  console.log(`generations that would proceed with empty {}: ${emptyAnalyses}/${rows.length}`);

  // Cost impact: extra output tokens only on JDs that previously truncated.
  const extra = rows.filter((r) => r.truncatedAtOldCap).reduce((a, r) => a + (r.out - 1024), 0);
  const totalCost = rows.reduce((a, r) => a + r.inTok * HAIKU_IN + r.out * HAIKU_OUT, 0);
  console.log(
    `\nextra output tokens vs old cap: ${extra} across ${rows.length} parses ` +
      `= $${(extra * HAIKU_OUT).toFixed(5)} (${((100 * extra * HAIKU_OUT) / totalCost).toFixed(1)}% of parse-stage cost)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
