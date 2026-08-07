#!/usr/bin/env tsx
// One-off measurement: how many output tokens does the JD parser actually need?
//
// The benchmark found MAX_TOKENS.parser = 1024 truncates 17% of standard JDs and
// 100% of long ones. Truncated calls only tell us the parser needed MORE than
// 1024 — not how much more. This runs the same prompt with a deliberately
// generous cap so the real requirement can be observed rather than guessed.
//
//   npx tsx scripts/benchmark/measure-parser-budget.ts

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MODELS } from "../../lib/constants";
import { parseJson } from "../../lib/llm-json";
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

// Generous ceiling — high enough that nothing realistic hits it, so every
// observation is a true requirement rather than another censored value.
const PROBE_CAP = 8192;

const fixtures = loadFixtures(join(HERE, "jds")).filter((f) => !f.overCap);

// Every long fixture (the known-failing bucket) plus the longest standard one
// from each category, which is where standard-length truncation concentrates.
const byCat = new Map<string, typeof fixtures>();
for (const f of fixtures) {
  if (!byCat.has(f.category)) byCat.set(f.category, []);
  byCat.get(f.category)!.push(f);
}
const targets = [
  ...(byCat.get("long") ?? []),
  ...["frontend", "backend", "aiml", "generalist"].flatMap((c) =>
    (byCat.get(c) ?? []).sort((a, b) => b.chars - a.chars).slice(0, 2)
  ),
];

async function main() {
  console.log(`Probing ${targets.length} fixtures at max_tokens=${PROBE_CAP} using ${MODELS.parser}\n`);
  console.log("fixture                                   jd_chars  out_tok  stop_reason  parses");
  console.log("-".repeat(84));

  const results: { file: string; category: string; chars: number; out: number; ok: boolean }[] = [];

  for (const f of targets) {
    const resp = await getAnthropic().messages.create({
      model: MODELS.parser,
      max_tokens: PROBE_CAP,
      messages: [{ role: "user", content: buildJdParserPrompt(f.text) }],
    });
    const raw = resp.content[0]?.type === "text" ? resp.content[0].text : "";
    const parsed = parseJson<Partial<JdAnalysis>>(raw);
    results.push({
      file: f.file,
      category: f.category,
      chars: f.chars,
      out: resp.usage.output_tokens,
      ok: parsed.ok,
    });
    console.log(
      `${f.file.slice(0, 40).padEnd(40)}  ${String(f.chars).padStart(7)}  ${String(
        resp.usage.output_tokens
      ).padStart(7)}  ${(resp.stop_reason ?? "?").padEnd(11)}  ${parsed.ok ? "yes" : "NO"}`
    );
  }

  const outs = results.map((r) => r.out).sort((a, b) => a - b);
  const longOuts = results.filter((r) => r.category === "long").map((r) => r.out);
  const stdOuts = results.filter((r) => r.category !== "long").map((r) => r.out);

  console.log("\n" + "=".repeat(84));
  console.log(
    `observed output tokens: min ${outs[0]}  median ${outs[Math.floor(outs.length / 2)]}  max ${outs[outs.length - 1]}`
  );
  if (stdOuts.length) console.log(`  standard JDs: max ${Math.max(...stdOuts)}`);
  if (longOuts.length) console.log(`  long JDs:     max ${Math.max(...longOuts)}`);
  console.log(`all parsed successfully: ${results.every((r) => r.ok) ? "yes" : "NO"}`);
  console.log(`hit probe ceiling (${PROBE_CAP}): ${results.filter((r) => r.out >= PROBE_CAP).length}`);
  const max = Math.max(...outs);
  console.log(`\nobserved max ${max} -> 2x headroom would be ${Math.ceil((max * 2) / 512) * 512}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
