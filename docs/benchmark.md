# Generation pipeline benchmark

Measurement of the Shortlist `/api/generate` pipeline: what the current model
routing costs relative to an all-Sonnet control, what the validator's pass rate
looks like across prompt versions, and whether the fail-closed reliability paths
are exercised in practice.

This document reports what was measured. Where a result is unflattering or a
number is unstable, it is stated here rather than omitted.

---

## 1. Methodology

### 1.1 What was measured

The pipeline under test is the one in `app/api/generate/route.ts`: a JD parse
call, a streamed generation call, a validation call, and a conditional single
retry when validation does not return PASS.

The harness (`scripts/benchmark/`) **imports** every prompt builder, the JSON
parser, and the verdict logic from `lib/`. It does not reimplement them. What it
does reproduce is the orchestration sequencing, which lives inline inside the
route's `ReadableStream` and cannot be imported from outside a Next.js request
context.

To keep the harness from measuring a divergent copy, three things were moved out
of the route into a new `lib/pipeline.ts` and are now imported by both the route
and the harness:

- `GENERATOR_SYSTEM_PROMPT` — moved byte-for-byte (verified by SHA-256 against
  the pre-refactor version in git).
- `buildDocPrompt()` — the doc-type dispatch.
- `MAX_TOKENS` — the per-stage output caps.

That refactor is the only production change made for this benchmark. It is
behavior-preserving: `tsc --noEmit` and `next build` both pass, and every removed
line has an identical replacement.

### 1.2 Test set

40 job descriptions in `scripts/benchmark/jds/`. Fixture-set SHA-256 (first 16
hex): `783cd3c8ac5d3ede`.

| | chars | words |
|---|---|---|
| mean | 5,451 | 803 |
| min | 2,766 | 438 |
| max | 17,071 | 2,322 |

| Category | n | mean chars | range |
|---|---|---|---|
| `aiml` | 8 | 3,112 | 2,940–3,287 |
| `backend` | 8 | 3,059 | 2,924–3,204 |
| `frontend` | 8 | 3,119 | 2,825–3,789 |
| `generalist` | 8 | 2,997 | 2,766–3,272 |
| `long` | 5 | 14,098 | 13,730–14,794 |
| `oversize` | 3 | 16,416 | 15,808–17,071 |

**37 are eligible** (≤15,000 chars). **3 exceed the route's input limit** and are
recorded as rejections with zero API calls.

**The fixtures are synthetic.** They were authored by Claude (Opus 5) on
2026-08-05 specifically for this benchmark. They are not scraped and not
anonymized real postings. See §5 for why this matters.

The `long` bucket sits deliberately just under the route's 15,000-character input
limit, which is the maximum pressure the application can put on the JD parser's
1,024-token output budget. The `oversize` bucket exceeds that limit; the harness
applies the same `LIMITS.jdMax` check the route applies and records those
fixtures as input-validation rejections with zero API calls.

### 1.3 Held constant

Only model routing varies between configurations. Everything else is fixed:

| Variable | Value |
|---|---|
| Candidate resume | one synthetic resume, 2,154 chars, used for every generation |
| `document_type` | `bullets` |
| `user_type` | `mid_career` |
| `tone` | `professional` |
| `max_tokens` | parser 1024, generator 2048, validator 1024 (from `lib/pipeline.ts`) |
| Prompt versions | `jd-parser-v1`, `bullets-v3`, `validator-v2` |
| `PROMPT_AB_VARIANT` | `A` (unset in env, defaults to A) |
| Runs per config | 2 |
| JD order | shuffled per (config, run) with a seeded PRNG, seed `20260805` |

### 1.4 Configurations

| | JD parse | generation | validation |
|---|---|---|---|
| **Config A** (current production routing) | `claude-haiku-4-5-20251001` | `claude-sonnet-4-6` | `claude-haiku-4-5-20251001` |
| **Config B** (all-Sonnet control) | `claude-sonnet-4-6` | `claude-sonnet-4-6` | `claude-sonnet-4-6` |

### 1.5 Deliberate divergences from production

These are differences between the harness and the deployed route. Each affects
how the numbers should be read.

1. **The Upstash JD-analysis cache is bypassed.** The route reads a SHA-256-keyed
   cache before parsing. A cache hit would zero out the parse stage entirely and
   destroy the A/B comparison, so the harness never touches Redis and every run
   performs a real parse call. In production with a warm cache, the parse-stage
   cost and latency reported here would not be paid on a repeat JD.
2. **The Anthropic SDK's built-in retry is disabled** (`maxRetries: 0`). If the
   SDK retried internally it would hide 429s and 529s from the records and fold
   the retry wait into a single call's measured wall-clock. The harness owns
   retry policy explicitly: exponential backoff, base 2s, doubling, capped at
   60s, full jitter, 6 attempts.
3. **No Supabase auth, rate limiting, or DB write**, and no Stage 5 tailoring
   call. The tailoring call fires after the `done` SSE event and its tokens are
   not counted by the route either.
4. **Latency is measured client-side**, summing per-stage wall-clock. It excludes
   harness-side backoff sleeps but includes network round-trip.

### 1.6 Pricing

| Model | Input $/MTok | Output $/MTok |
|---|---|---|
| `claude-sonnet-4-6` | $3.00 | $15.00 |
| `claude-haiku-4-5-20251001` | $1.00 | $5.00 |

Source: <https://platform.claude.com/docs/en/docs/about-claude/pricing.md>,
fetched live 2026-08-05. Input and output are priced separately per model. No
pricing modifier applies — the benchmark uses no batch API, no prompt caching,
no fast mode, and the default global inference geography.

### 1.7 Environment

| | |
|---|---|
| Hardware | Apple M1, 8 cores |
| OS | macOS 26.5.2 |
| Node | v25.6.0 |
| `@anthropic-ai/sdk` | ^0.78.0 |
| Execution | sequential (concurrency 1) |
| Network | single residential connection, single geographic location |
| Run date | 2026-08-06 (03:32–05:35 UTC) |

### 1.8 Run record

| | |
|---|---|
| Executed | 2026-08-06 03:32:35Z → 05:35:30Z (2h 03m wall-clock) |
| Units | 240 pipeline executions (160 Experiment 1, 74 version series, 2 pilot, plus 18 over-cap rejections counted within those) |
| API calls | 799 |
| Estimated cost | $11.07 |
| **Actual cost** | **$7.5612** |

The run came in **32% under estimate**. The estimate was extrapolated from a
pilot JD that happened to trigger a retry in Config A, which inflated the
projected per-generation cost. This is the direction the estimate's stated
caveat warned about, in reverse.

> **A note on one harness defect, disclosed rather than corrected in the data.**
> During this run, the stage label `validate_retry` conflated two different
> calls: validating output produced by a generation retry, and the second model
> call `parseLlmJson` makes when the first validator response fails to parse.
> The totals are unaffected — every call was counted, timed, and priced — but
> the per-stage tables below would be ambiguous without decomposition. The
> counts are decomposed exactly by arithmetic (`validate_retry` calls minus
> generations with `retry_count > 0`) wherever they appear. The harness has
> since been corrected to emit a distinct `validate_parse_retry` stage, so
> future runs will not need this note.

---

## 2. Experiment 1 — routing cost and latency

Both configurations ran the same 37 eligible JDs twice, with JD order shuffled
per (config, run).

### 2.1 Headline

| | Config A (current) | Config B (all-Sonnet) |
|---|---|---|
| Generations | 74 | 74 |
| Input tokens | 509,476 | 366,235 |
| Output tokens | 164,136 | 155,816 |
| **Total cost** | **$2.0694** | **$3.4359** |
| **Mean cost / generation** | **$0.02796** | **$0.04643** |
| Latency mean | 28,028 ms | 41,882 ms |
| Latency p50 | 22,436 ms | 41,041 ms |
| Latency p90 | 40,988 ms | 45,167 ms |
| Latency p95 | 46,860 ms | 49,468 ms |

**Config A is 39.8% cheaper and 33.1% faster than Config B** on mean cost per
generation and mean end-to-end latency.

### 2.2 Between-run variance

| | run 1 cost/gen | run 2 cost/gen | spread | run 1 latency | run 2 latency | spread |
|---|---|---|---|---|---|---|
| Config A | $0.02851 | $0.02742 | **4.0%** | 28,899 ms | 27,157 ms | **6.4%** |
| Config B | $0.04615 | $0.04671 | **1.2%** | 41,590 ms | 42,174 ms | **1.4%** |

All four spreads are below the 10% instability threshold set before the run.
**The deltas in §2.1 are stable across runs** and are not an artifact of a single
noisy pass.

### 2.3 Per-stage breakdown

Config A:

| Stage | Model | Calls | Input tok | Output tok | Cost | Mean latency |
|---|---|---|---|---|---|---|
| parse | Haiku 4.5 | 74 | 103,132 | 66,960 | $0.4379 | 8,076 ms |
| generate | Sonnet 4.6 | 74 | 141,185 | 21,979 | $0.7532 | 7,501 ms |
| validate | Haiku 4.5 | 74 | 131,380 | 41,927 | $0.3410 | 5,817 ms |
| generate (retry) | Sonnet 4.6 | 30 | 70,318 | 9,644 | $0.3556 | 8,474 ms |
| validate (retry + parse recovery) | Haiku 4.5 | 35 | 63,461 | 23,626 | $0.1816 | 6,764 ms |

Config B:

| Stage | Model | Calls | Input tok | Output tok | Cost | Mean latency |
|---|---|---|---|---|---|---|
| parse | Sonnet 4.6 | 74 | 103,132 | 75,569 | $1.4429 | 19,516 ms |
| generate | Sonnet 4.6 | 74 | 131,787 | 21,244 | $0.7140 | 7,258 ms |
| validate | Sonnet 4.6 | 74 | 127,788 | 56,995 | $1.2383 | 14,605 ms |
| generate (retry) | — | 0 | — | — | — | — |
| validate (parse recovery) | Sonnet 4.6 | 2 | 3,528 | 2,008 | $0.0407 | 18,608 ms |

Decomposition of the conflated `validate_retry` line: Config A's 35 calls are 30
post-generation-retry validations plus 5 JSON parse-recovery calls; Config B's 2
calls are both parse recovery.

**Where the money and time actually go.** The generation stage — the only stage
using the same model in both configs — costs almost identically ($0.7532 vs
$0.7140) and takes almost identically as long (7,501 vs 7,258 ms). The entire
delta comes from parse and validate. Parse alone is $0.44 → $1.44 (3.3×) and
8,076 → 19,516 ms (2.4×).

**Config A pays a retry cost that Config B does not.** The retry path fired on
30 of 74 Config A generations (40.5%) and on **zero** Config B generations,
adding $0.5372 to Config A. Config A is still 39.8% cheaper *despite* carrying
that overhead. §3.2 explains why the retry rates differ, and why that difference
is not evidence that Config B produces better output.

---

## 3. Experiment 2 — validator pass rate

### 3.1 Current prompt version, Config A (n = 74)

| Metric | Value |
|---|---|
| Mean overall | 7.93 |
| Median overall | 8.60 |
| Pass rate | **75.7%** (56 PASS / 14 REVISE / 4 REJECT) |
| Validation unavailable | 1 |
| Retry rate | 40.5% |
| Flags per generation | 3.34 |

Score distribution:

| Bucket | <4 | 4–5 | 5–6 | 6–7 | 7–8 | 8–9 | 9–10 |
|---|---|---|---|---|---|---|---|
| n | 3 | 0 | 2 | 11 | 7 | 40 | 10 |

Mean per-dimension scores:

| specificity | relevance | authenticity | impact | clean |
|---|---|---|---|---|
| 8.36 | **6.82** | 8.04 | 8.48 | 8.96 |

**Relevance is the weakest dimension by a wide margin** (6.82 against 8.0–9.0 for
everything else), and it is the dimension most directly downstream of the JD
analysis — which §4 shows was empty for a large fraction of generations.

Flag frequency by type:

| Type | Count |
|---|---|
| hallucination | 138 |
| skill_inflation | 35 |
| irrelevant | 32 |
| relevance | 22 |
| other | 11 |
| vague_claim | 7 |
| passive_voice | 1 |
| authenticity_concern | 1 |

Flags per generation by JD category:

| aiml | backend | frontend | generalist | long |
|---|---|---|---|---|
| 2.75 | 2.94 | **4.44** | 3.62 | 2.70 |

Frontend JDs produced the most flags per generation. Note that `long` produced
the *fewest* — which is not a quality signal, because long JDs are precisely the
ones whose JD analysis was empty (§4.2), leaving the validator less to check
against.

### 3.2 Config B is not a valid quality control

Config B's numbers look better and should not be read that way:

| | Config A | Config B |
|---|---|---|
| Pass rate | 75.7% | **98.6%** |
| Mean overall | 7.93 | 7.84 |
| Retry rate | 40.5% | 0.0% |
| Flags / generation | 3.34 | **6.54** |
| hallucination flags | 138 | **369** |

Config B passes 98.6% of generations while flagging **twice as many** issues per
generation and nearly three times as many hallucinations. Its verdicts cluster
entirely in 7–8 and 8–9 with no generation below 7. That is the profile of a
grader applying a different standard, not of a better generator.

Two structural reasons this comparison cannot support a quality claim:

1. **The judge changes with the generator.** Config A is graded by Haiku; Config
   B is graded by Sonnet. A pass-rate difference between them measures grader
   disagreement at least as much as output quality.
2. **Config B's parse stage is broken** (§4.2). It generated from an empty JD
   analysis in 94% of cases, and its validator received the same empty analysis,
   so it had almost nothing to check relevance against.

**The cost and latency comparison in §2 remains valid** — it measures what the
routing actually costs to run, which is the question that was asked. The quality
comparison does not, and no quality claim should be made from it.

### 3.3 Pass rate over prompt versions

Historical `bullets` prompt bodies were checked out from git and run against the
same test set at Config A routing, one run each (n = 37). The current version is
shown at run 1 only, for equal n.

| Version | Commit | n | Mean overall | Pass rate | Flags/gen | Retry rate |
|---|---|---|---|---|---|---|
| `bullets-v1` | `e42b838` (2026-02-25) | 37 | **8.05** | **75.7%** | **2.76** | 40.5% |
| `bullets-v2` | `75275e1` (2026-02-28) | 37 | 7.85 | 67.6% | 3.35 | 35.1% |
| `bullets-v3` | `d039e20` (2026-03-03) | 37 | 7.81 | 73.0% | 3.65 | 40.5% |

**This is the least flattering result in the benchmark, and it is reported as
measured: the two documented prompt "improvements" did not improve the measured
pass rate.** `bullets-v1` scores highest on mean overall, highest on pass rate,
and lowest on flags per generation.

The honest reading, though, is **"no measurable improvement," not "v1 is
better."** The pass-rate gap between v1 and v3 is 28 versus 27 PASS verdicts out
of 37 — a single generation. That is well inside noise for n = 37 at one run
each, and no significance testing was performed. What the data supports is that
v2 and v3 did not produce a detectable quality gain on this test set under this
grader. It does not support reverting anything.

Two further caveats specific to this series, restated from §5.6: historical
prompts were graded by the *current* validator, not the one they shipped with;
and v3's stated goal was reducing an "AI tell" (em dashes as clause connectors),
which the validator's rubric does not score. **A prompt change targeting
something the grader does not measure will not move this number, and its absence
here is not evidence the change was worthless.**

---

## 4. Experiment 3 — reliability

Across all 799 API calls made during the run.

### 4.1 API-level reliability: nothing failed

| Metric | Count |
|---|---|
| Total calls | 799 |
| Terminal failures | **0** |
| Retry attempts (429/529/5xx/connection) | **0** |
| Calls that exhausted all 6 backoff attempts | **0** |
| Generations that hit `max_tokens` on the generate stage | **0** |

No rate limiting, no overload, no server errors, no connection failures. The
exponential-backoff machinery was never exercised. That is a real finding about
this run's conditions — sequential execution, one client, off-peak — and it means
the benchmark says nothing about behaviour under rate-limit pressure.

### 4.2 JSON truncation: the failure that actually happens

| Metric | Count |
|---|---|
| Completed generations | 224 |
| JD parse succeeded | **120 (53.6%)** |
| JD parse failed — `truncated` | **101** |
| JD parse failed — `invalid` | 3 |
| Generations that proceeded with an empty `{}` JD analysis | **104 (46.4%)** |

Parse-stage behaviour by model:

| Model | Calls | Mean output tokens | Max | Hit 1024 cap | `stop_reason: max_tokens` |
|---|---|---|---|---|---|
| Haiku 4.5 | 149 | 912 | 1024 | 25 (17%) | 25 |
| Sonnet 4.6 | 75 | 1021 | 1024 | **71 (95%)** | 71 |

Parse success by JD length:

| Config | JD bucket | n | Parse OK |
|---|---|---|---|
| A (Haiku) | standard (~3k chars) | 64 | 57 (89%) |
| A (Haiku) | long (>13k chars) | 10 | **0 (0%)** |
| B (Sonnet) | standard | 64 | **4 (6%)** |
| B (Sonnet) | long | 10 | **0 (0%)** |

Three findings here, in order of importance:

**1. Long JDs fail to parse 100% of the time, in both configurations.** Every one
of the 10 long-JD runs produced a truncated JSON analysis. `buildJdParserPrompt`
asks for a 12-field structured analysis; a 14,000-character JD produces enough
content that the response exceeds the parser's 1,024-token output budget every
time. `app/api/generate/route.ts:245` collapses the truncated result to `{}` and
proceeds. Nothing surfaces this to the user, nothing logs it, and the generation
completes normally.

**2. Haiku is operating at the edge of its budget on ordinary JDs too.** Mean
parse output is 912 tokens against a 1,024 cap. 17% of standard-length JDs
already exceed it. This is not a long-JD-only problem; it is a systematically
under-provisioned token budget that long JDs merely guarantee will fail.

**3. Sonnet is a *worse* parser than Haiku here, because it is more verbose.**
Sonnet hit the cap on 95% of parse calls versus Haiku's 17%. Config B therefore
ran with an empty JD analysis for 94% of standard JDs. The "better model" is the
one that breaks the stage, purely as a function of output length against a fixed
cap.

### 4.3 The quality gate rewards the failure

Restricting to Config A and comparing generations by whether their JD analysis
survived:

| JD analysis | n | Mean overall | Pass rate |
|---|---|---|---|
| Populated | 56 | 7.67 | 69.6% |
| **Empty `{}`** | **17** | **8.78** | **100.0%** |

Generations that lost their JD analysis entirely scored **higher** and passed at
**100%**.

The mechanism is structural rather than mysterious. `buildValidatorPrompt`
receives the same `jdAnalysis` object the generator received. When it is `{}`,
the validator has no `must_haves`, no `key_terminology`, and no
`hiring_manager_worry` to check the output against — so it cannot penalise a
bullet set for failing to address requirements it cannot see. The relevance
dimension, already the weakest at 6.82, has nothing to grade.

**The pipeline's quality gate is blind to its most consequential failure mode,
and scores it as a success.** This is measured, not inferred: the score
difference is in the data. What is *not* established is how much worse the output
actually is — see §5.7.

### 4.4 Fail-closed paths: exercised, and working

| Path | Count | Behaviour observed |
|---|---|---|
| `parseLlmJson` recovery call (validator response unparseable, model re-called) | **11** | Recovered in 7 cases |
| Validation ended `unavailable: true` (both attempts failed) | **4** | Fail-closed — no fabricated PASS |
| Retry suppressed because validation was unavailable | 4 | Correct per `route.ts:359` |
| Over-cap JDs rejected before any API call | 18 | 3 fixtures × 6 passes |

All 11 parse-recovery calls were triggered by `truncated` first responses — the
same root cause as §4.2, this time on the validator's 1,024-token budget rather
than the parser's.

The four `unavailable` outcomes are the fail-closed design working exactly as
intended: the validator response could not be parsed twice, so the pipeline
reported the quality gate as unavailable rather than inventing a PASS, and
correctly suppressed the retry (retrying an ungraded output tells you nothing).

**Answering the question this experiment was built for:** the fail-closed
validation work is *not* merely theoretically present. It fired 11 times for
parse recovery and 4 times for full fail-closed reporting across 224
generations. The truncation-detection path in `lib/llm-json.ts` fired 112 times
in total (101 parser + 11 validator). This machinery is load-bearing in normal
operation, not defensive code awaiting a rare event.


## 5. What these numbers don't prove

This section is deliberately longer than the results. Every item here is a real
limit on what can be claimed.

### 5.1 The fixtures are LLM-authored

All 40 job descriptions were written by Claude for this benchmark. They were
written to be structurally and tonally realistic, but they are not real
postings.

This plausibly biases results **in the pipeline's favour**. LLM-authored text
likely sits closer to the model's own distribution than real job postings do —
more consistent structure, cleaner section headings, less idiosyncratic
formatting, no HTML artifacts or copy-paste damage. JD-parse success rates and
validator scores on a real corpus could reasonably be worse. Nothing here
establishes how much worse.

This is the single largest threat to external validity, and it applies to every
number in the document.

### 5.2 Config B is a cost control, not a quality control

This turned out to matter more than anticipated. Config B was designed as an
"identical pipeline, all-Sonnet" control. It is a valid control for **cost and
latency** — it measures what the all-Sonnet routing costs to run, which is the
question §2 answers.

It is **not** a valid control for quality, for two reasons established in §3.2
and §4.2: the validator changes along with the generator, so any pass-rate
difference conflates grader disagreement with output quality; and Sonnet's parse
stage truncated on 95% of calls, so Config B generated from an empty JD analysis
in 94% of standard cases.

A properly designed quality control would hold the validator fixed while varying
only the generator. That experiment was not run.

### 5.3 Quality scores are an LLM judging an LLM

The validator is a language model scoring another language model's output
against a rubric. It is not ground truth.

Two specific problems:

- **In Config A the judge is Haiku scoring Sonnet's output.** A smaller model is
  grading a larger one. There is no reason to assume it grades accurately, and
  no reason to assume it grades Config A and Config B equivalently — which
  matters because the two configs use *different judges*. Any quality comparison
  between configs is confounded by the grader changing along with the generator.
- **No human evaluation was performed.** Nobody read the generated bullets and
  scored them. The pass rate measures agreement with a rubric-following model,
  not whether a recruiter would find the output good.

The validator's hallucination and skill-inflation flags are similarly
unvalidated: a flagged claim has not been checked against the source resume by a
human, so the flag rate measures the validator's sensitivity, not the
generator's actual fabrication rate.

### 5.4 Latency is a single-machine, single-network measurement

Wall-clock was measured client-side from one residential connection on one
machine on one day. It includes network round-trip, TLS, and whatever
API-side queuing was happening at the time. It is not a server-side measurement
and it is not a measurement of what a Vercel function would observe.

Absolute latency numbers should be treated as indicative only. The *relative*
comparison between configs is more defensible because both configs ran
interleaved on the same connection across the same window, but even that is
vulnerable to drift in API-side load over the run's duration.

### 5.5 The cost delta is specific to this workload

The cost ratio between configs depends on the token mix, which depends on: JD
length distribution, the single fixed candidate resume, the `bullets` document
type, and the specific prompt versions in use. A different document type
(`cover_letter` produces longer output) or a different JD length profile would
move the ratio.

The delta also depends on how often the retry path fires, since a retry doubles
the generate and validate stages. Retry rate is itself a function of validator
strictness, which differs between configs.

### 5.6 Sample size and design

- 37 eligible JDs, one candidate profile, one document type, one tone.
- 2 runs per configuration. Two runs establish whether a delta is grossly
  unstable; they do not support a confidence interval, and no significance
  testing was performed.
- The prompt-version series is 1 run per historical version.
- No cross-validation of any kind.

### 5.7 The prompt-version series measures today's bar, not history

Historical prompt bodies (`bullets-v1`, `bullets-v2`) were checked out from git
and run against the **current** `validator-v2` and the **current**
`resolveVerdict` thresholds. This is the only way to get a comparable series,
but it means the numbers answer "how does v1's output score under today's
grader," not "what did v1 score at the time it shipped."

The harness also assumes the project's stated convention held — that the prompt
body was edited in the same commit that bumped the version string. It selects
the first commit in which each version string appears. If a prompt body was
edited without a version bump, the wrong body would be attributed.

### 5.8 The truncation finding is measured, not diagnosed

The benchmark establishes *that* long JDs fail to parse and *that* generation
proceeds on an empty analysis. It does not establish what the resulting output
loses. Nobody compared a bullet set generated with a full JD analysis against one
generated with `{}` for the same JD and candidate. The quality scores suggest the
validator does not notice the difference, but the validator also does not see the
JD analysis — it sees the JD-derived fields passed into its own prompt, which are
empty in exactly the same cases. That is a blind spot in the measurement, not
evidence that the output is fine.

### 5.9 The over-cap fixtures contribute no API data

Three fixtures exceed the route's 15,000-character input limit. They are counted
as rejections and contribute nothing to any cost, latency, or quality number.
They demonstrate that the limit fires; they say nothing about behaviour on long
input beyond the limit.

### 5.10 The cache bypass cuts both ways

Bypassing the JD cache was necessary to compare the parse stage at all. But it
means the reported per-generation cost is the **cold-cache** cost. In production,
a repeat JD skips the parse call entirely, so real-world average cost per
generation is lower than reported here by an amount that depends on cache hit
rate — which this benchmark did not measure.

---

## 6. Resume-ready claims

Each claim below is phrased to be defensible, carries its supporting number, and
names the specific hole a sharp interviewer would go for. If you cannot answer
the "where it's vulnerable" line comfortably, do not use the claim.

### Claim 1 — cost routing

> "Cut LLM cost per generation 40% by routing JD parsing and output validation
> to Haiku while keeping Sonnet for generation — measured across 37 job
> descriptions, two configurations, two runs each, with between-run variance
> under 5%."

Supporting numbers: $0.02796 vs $0.04643 mean cost per generation (39.8%);
between-run cost spread 4.0% (Config A) and 1.2% (Config B).

**Where it's vulnerable.** The obvious follow-up is *"did quality drop?"* You
cannot answer that from this benchmark, and you should say so. The all-Sonnet
control used a different validator *and* had a broken parse stage (§3.2, §4.2),
so its pass rate is not comparable. The honest answer is: "the cost measurement
is clean; the quality comparison isn't, because the control changed the grader
too. A proper quality test would hold the validator fixed and vary only the
generator, and I didn't run that." Saying this unprompted is stronger than being
caught by it.

A second follow-up: *"40% of what baseline?"* The comparison is against
all-Sonnet, not against a naive implementation. It measures a routing decision,
not a from-scratch optimisation.

### Claim 2 — latency routing

> "Reduced end-to-end generation latency 33% through the same routing change —
> 41.9s down to 28.0s mean, with p50 of 22.4s against the all-Sonnet control's
> 41.0s."

Supporting numbers: mean 28,028 ms vs 41,882 ms; p50 22,436 vs 41,041; p90
40,988 vs 45,167; p95 46,860 vs 49,468.

**Where it's vulnerable.** Client-side measurement from one machine on one
residential connection on one night (§5.4). It includes network round-trip and
whatever API-side load existed. The relative comparison is more defensible than
the absolute numbers because both configs ran interleaved on the same connection
— lead with that if pushed. Also note the p95 gap is much narrower than the mean
gap (5% vs 33%), so "33% faster" is a statement about the typical case, not the
tail.

### Claim 3 — the diagnostic finding (strongest claim here)

> "Instrumented the generation pipeline and found that 46% of generations were
> silently running with an empty job-description analysis: the JD parser's
> 1,024-token output cap truncated its JSON, and the error path discarded the
> failure and proceeded. Long job descriptions failed 100% of the time."

Supporting numbers: 104 of 224 generations proceeded with `{}`; JD parse
succeeded 120/224 (53.6%); long JDs (>13k chars) parsed successfully 0/10 in
both configurations; Haiku parse output averaged 912 tokens against a 1,024 cap
with 17% of standard JDs already exceeding it.

**Where it's vulnerable.** *"What did that actually cost the user?"* — you don't
know (§5.8). You measured that the analysis was lost and that the validator
scored those generations *higher*, not that the output was worse. Be precise:
this is a discovered defect with a quantified frequency and an identified
mechanism, not a measured quality regression. That is still a strong finding;
overstating it into "46% of outputs were bad" is where it breaks.

Second angle: *"the fixtures were synthetic, so maybe real JDs are shorter."*
Fair. But the mechanism is length-driven and the standard-length failure rate
(17% at the cap for Haiku) is independent of the long bucket.

### Claim 4 — the quality gate blind spot

> "Showed the pipeline's own quality gate was blind to its most consequential
> failure: generations that lost their JD analysis scored 8.78 and passed 100%
> of the time, versus 7.67 and 69.6% for generations that kept it — because the
> validator receives the same empty analysis and has no requirements left to
> check relevance against."

Supporting numbers: n=17 empty vs n=56 populated, Config A.

**Where it's vulnerable.** n=17 is small, and the mechanism explanation, while
well-grounded in `buildValidatorPrompt`'s inputs, is an inference from code
reading rather than an ablation. An interviewer could reasonably ask whether you
confirmed it by feeding the validator a populated analysis with unchanged output.
You didn't. Say so, and say that's the experiment you'd run next.

### Claim 5 — reliability instrumentation

> "Verified the pipeline's fail-closed validation is load-bearing rather than
> defensive: across 799 API calls, the JSON truncation-detection path fired 112
> times, the validator's retry-parser recovered 7 of 11 unparseable responses,
> and 4 generations correctly reported the quality gate as unavailable rather
> than fabricating a passing score."

Supporting numbers: 101 parser truncations + 11 validator truncations; 11
recovery calls, 4 ending `unavailable`; 0 terminal API failures across the run.

**Where it's vulnerable.** *"Did you test it under rate limiting?"* No — zero
429s, 529s, or 5xx occurred, so the exponential-backoff machinery was never
exercised (§4.1). The claim is about the JSON-parsing failure paths, not about
resilience under API pressure. Don't let it be read as the latter.

### Claim 6 — the negative result

> "Ran the current and two prior prompt versions against the same test set and
> found no measurable pass-rate improvement from either documented 'quality
> improvement' revision (75.7% → 67.6% → 73.0%, n=37 each, differences within
> noise)."

**Where it's vulnerable.** This one is safe *because* it's negative and
appropriately hedged — but only if you deliver the hedge. The v1-vs-v3 pass-rate
gap is one generation out of 37. If you present it as "v1 was better" you'll
deserve the pushback. Present it as "the changes didn't move the metric I was
measuring, and one of them (v3's em-dash ban) targeted something the validator
doesn't score at all" — which demonstrates you understand what your own
measurement can and can't see.

This is arguably the most credible thing on the list, because most candidates
only report wins.

### Claims NOT to make from this benchmark

- **Anything about output quality between Config A and Config B.** §3.2.
- **"Improved quality X%."** No prompt or model change was made to improve
  anything; this was measurement only, and the version series found no gain.
- **Any generalisation to real job postings.** The corpus is LLM-authored (§5.1).
- **Anything about production behaviour under load or with a warm JD cache.**
  Neither was measured (§4.1, §5.10).

---

## 7. Reproducing

```bash
npm run bench -- --preflight      # checks only, spends nothing
npm run bench -- --dry-run        # full matrix with a stubbed client, $0
npm run bench -- --estimate-only  # live 1-JD pilot + extrapolation
npm run bench -- --fresh          # full run, prompts for confirmation
npm run bench -- --report-only scripts/benchmark/results/raw-<ts>.jsonl
```

Raw per-call records, full generated outputs, and `summary.json` are written to
`scripts/benchmark/results/` (gitignored). The fixture set is committed, so a
re-run against the same fixtures is directly comparable via the fixture-set hash
recorded in every results file.
