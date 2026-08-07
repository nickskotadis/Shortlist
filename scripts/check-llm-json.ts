#!/usr/bin/env tsx
// Assertions for lib/llm-json.ts, focused on the truncated-vs-invalid
// distinction. The repo has no test framework; this is a standalone check that
// exits non-zero on failure.
//
//   npx tsx scripts/check-llm-json.ts

import { parseJson } from "../lib/llm-json";

interface Case {
  name: string;
  input: string;
  expect: "ok" | "empty" | "truncated" | "invalid";
}

const CASES: Case[] = [
  // ── Happy paths ─────────────────────────────────────────────────────────────
  { name: "bare object", input: '{"a":1}', expect: "ok" },
  { name: "fenced object", input: '```json\n{"a":1}\n```', expect: "ok" },
  { name: "fenced, no language tag", input: '```\n{"a":1}\n```', expect: "ok" },
  { name: "prose preamble", input: 'Here is the result:\n{"a":1}', expect: "ok" },
  { name: "top-level array", input: '["a","b"]', expect: "ok" },
  { name: "nested object + array", input: '{"a":{"b":[1,2]},"c":[]}', expect: "ok" },
  {
    name: "braces inside string content",
    input: '{"a":"a { brace } in text","b":2}',
    expect: "ok",
  },
  { name: "escaped quote in string", input: '{"a":"she said \\"hi\\""}', expect: "ok" },
  {
    name: "trailing prose after JSON",
    input: '{"a":1}\nHope that helps!',
    expect: "ok",
  },

  // ── Empty ───────────────────────────────────────────────────────────────────
  { name: "empty string", input: "", expect: "empty" },
  { name: "whitespace only", input: "   \n\t ", expect: "empty" },

  // ── No JSON at all ──────────────────────────────────────────────────────────
  { name: "prose only", input: "I cannot help with that.", expect: "invalid" },

  // ── Genuine truncation: stops mid-token ─────────────────────────────────────
  {
    name: "cut off mid-string",
    input: '{"role":"Senior Engineer","worry":"Will they be able to',
    expect: "truncated",
  },
  {
    name: "cut off after a comma",
    input: '{"a":1,"b":2,',
    expect: "truncated",
  },
  {
    name: "cut off inside nested array",
    input: '{"must_haves":["Go","Postgres","Kub',
    expect: "truncated",
  },
  {
    name: "cut off mid-string inside a fence (no closing fence)",
    input: '```json\n{"a":"unterminated',
    expect: "truncated",
  },

  // ── Finished but malformed: ends like completed JSON ────────────────────────
  // This is the case that was previously mislabelled "truncated". An unescaped
  // quote desynchronises string tracking, so braces in string content get
  // counted and the value never balances — but the model plainly finished.
  {
    name: "unescaped quote desyncs scanner, output complete",
    input: '{"a":"he said "hi" to me {","b":2}',
    expect: "invalid",
  },
  {
    name: "unbalanced but fence-closed",
    input: '```json\n{"a":{"b":1}\n```',
    expect: "invalid",
  },
  {
    name: "extra opening brace, still ends with closer",
    input: '{"a":{"b":1}',
    expect: "invalid",
  },
];

let failed = 0;
for (const c of CASES) {
  const r = parseJson<unknown>(c.input);
  const actual = r.ok ? "ok" : r.reason;
  const pass = actual === c.expect;
  if (!pass) failed++;
  console.log(
    `${pass ? "  ok  " : "  FAIL"}  ${c.name.padEnd(48)} expected ${c.expect.padEnd(9)} got ${actual}`
  );
}

console.log(`\n${CASES.length - failed}/${CASES.length} passed`);
if (failed) {
  console.error(`${failed} FAILED`);
  process.exit(1);
}
