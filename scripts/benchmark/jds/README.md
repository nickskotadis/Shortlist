# Benchmark JD fixtures

Job-description fixtures for `scripts/benchmark/`. One posting per `.txt` file.

## Provenance — read this before citing any benchmark number

**These 40 fixtures are synthetic. They were authored by Claude (Opus 5) for this
benchmark on 2026-08-05.** They are not scraped, not real postings, and not
anonymized real postings. They were written to be structurally and tonally
realistic across role type, seniority, company size, industry, and length.

This matters for interpreting results: LLM-authored text may sit closer to the
model's own distribution than real job postings do, which could plausibly inflate
JD-parse quality and validator scores relative to a real-world corpus. This
limitation is stated in `docs/benchmark.md` and should be restated anywhere these
numbers are quoted.

## Naming

`<category>-<nn>-<slug>.txt` — the harness parses `category` from the filename
prefix. Adding a file with a new prefix creates a new category automatically.

| Category | Count | Length | Purpose |
|---|---|---|---|
| `frontend` | 8 | 2.8–3.8k chars | Frontend / web roles |
| `backend` | 8 | 2.9–3.2k chars | Backend / infra roles |
| `aiml` | 8 | 2.9–3.3k chars | ML / data science roles |
| `generalist` | 8 | 2.8–3.3k chars | Generalist SWE, DevOps, EM, security, QA |
| `long` | 5 | 13.7–14.8k chars | Just under the app's 15,000-char cap — maximum pressure on the JD parser's 1024-token output budget, which is where the JSON truncation path in `lib/llm-json.ts` fires |
| `oversize` | 3 | 15.8–17.1k chars | Deliberately **over** the cap. `LIMITS.jdMax = 15_000` in `app/api/generate/route.ts` rejects these before any API call. The harness applies the same check and records them as `input_validation_rejected` at zero cost. |

## Replacing these with real postings

The harness reads whatever `.txt` files exist in this directory and reports the
actual composition it found, so you can delete these and drop in real postings.
Two things to know:

1. Keep the `<category>-` filename prefix, or category breakdowns collapse.
2. Every results file records a SHA-256 over the sorted fixture set, so a run
   against real postings is distinguishable from a run against these. The
   harness refuses to resume a checkpoint whose fixture hash does not match
   without `--fresh`.

If you add real postings, consider whether they should be committed — scraped
postings may carry licensing or attribution questions that these synthetic ones
do not. `scripts/benchmark/results/` is gitignored; this directory is not.
