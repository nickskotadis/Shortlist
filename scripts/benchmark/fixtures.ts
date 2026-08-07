// ── Fixture loading, composition stats, and deterministic shuffling ───────────

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Mirrors LIMITS.jdMax in app/api/generate/route.ts. A JD longer than this is
 * rejected by the route before any API call is made; the harness applies the
 * same check so that over-cap fixtures are measured the way production would
 * actually treat them (rejected, zero cost) rather than being sent anyway.
 */
export const JD_MAX_CHARS = 15_000;

export interface Fixture {
  file: string;
  category: string;
  text: string;
  chars: number;
  words: number;
  /** True when the fixture exceeds JD_MAX_CHARS and the route would reject it. */
  overCap: boolean;
}

export function loadFixtures(dir: string): Fixture[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .sort();

  return files.map((file) => {
    const text = readFileSync(join(dir, file), "utf8");
    const chars = text.length;
    return {
      file,
      category: file.split("-")[0] ?? "uncategorized",
      text,
      chars,
      words: text.split(/\s+/).filter(Boolean).length,
      overCap: chars > JD_MAX_CHARS,
    };
  });
}

export interface CategoryStats {
  category: string;
  count: number;
  meanChars: number;
  minChars: number;
  maxChars: number;
  meanWords: number;
}

export interface Composition {
  count: number;
  eligible: number;
  overCap: number;
  meanChars: number;
  minChars: number;
  maxChars: number;
  meanWords: number;
  minWords: number;
  maxWords: number;
  byCategory: CategoryStats[];
}

export function composition(fixtures: Fixture[]): Composition {
  const chars = fixtures.map((f) => f.chars);
  const words = fixtures.map((f) => f.words);
  const mean = (xs: number[]) =>
    xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;

  const categories = [...new Set(fixtures.map((f) => f.category))].sort();
  const byCategory = categories.map((category) => {
    const group = fixtures.filter((f) => f.category === category);
    const gc = group.map((f) => f.chars);
    return {
      category,
      count: group.length,
      meanChars: mean(gc),
      minChars: Math.min(...gc),
      maxChars: Math.max(...gc),
      meanWords: mean(group.map((f) => f.words)),
    };
  });

  return {
    count: fixtures.length,
    eligible: fixtures.filter((f) => !f.overCap).length,
    overCap: fixtures.filter((f) => f.overCap).length,
    meanChars: mean(chars),
    minChars: Math.min(...chars),
    maxChars: Math.max(...chars),
    meanWords: mean(words),
    minWords: Math.min(...words),
    maxWords: Math.max(...words),
    byCategory,
  };
}

/**
 * SHA-256 over the sorted (filename, content) pairs. Recorded in every results
 * file so a run against these synthetic fixtures is distinguishable from a run
 * against a replaced set, and so a checkpoint cannot be resumed against
 * different inputs.
 */
export function fixtureSetHash(fixtures: Fixture[]): string {
  const h = createHash("sha256");
  for (const f of [...fixtures].sort((a, b) => a.file.localeCompare(b.file))) {
    h.update(f.file).update("\0").update(f.text).update("\0");
  }
  return h.digest("hex").slice(0, 16);
}

/** Deterministic PRNG so shuffles are reproducible across checkpoint resumes. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates with a seeded PRNG. Does not mutate the input. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
