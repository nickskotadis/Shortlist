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

---

## 8. Follow-up: the parser token cap, fixed

The §4.2 finding was acted on after the benchmark run. This section records the
fix and its measured effect. **The numbers everywhere above this section reflect
the pre-fix pipeline** (`MAX_TOKENS.parser = 1024`) and are left unchanged so the
benchmark remains an honest record of what was measured on 2026-08-06.

### 8.1 Establishing the real requirement

Truncated calls only report that the parser needed *more* than 1,024 tokens, not
how much more — every failing observation was censored at the cap. Re-probing the
same fixtures at `max_tokens = 8192` produced uncensored measurements:

| JD bucket | Output tokens needed |
|---|---|
| standard (~3k chars) | 744 – 1,061 |
| long (13.7–14.8k chars) | 1,291 – 1,506 |

Nothing came close to the 8,192 probe ceiling, so these are true requirements.
The old cap of 1,024 sat *below* the requirement for every long JD and for a
minority of standard ones — which is exactly the observed failure profile.

### 8.2 The change

`MAX_TOKENS.parser`: **1024 → 4096** (`lib/pipeline.ts`), roughly 2.7× the
observed maximum.

Raising a cap is close to free: `max_tokens` bounds generation, it does not
reserve or bill capacity. JDs that already fit generate the same tokens and cost
exactly the same. The only JDs that cost more are the ones that were previously
producing an unusable truncated analysis.

### 8.3 Measured effect

Re-running the parser over all 37 eligible fixtures:

| | Before (cap 1024) | After (cap 4096) |
|---|---|---|
| Standard JDs parsing | 89% | 91% |
| **Long JDs parsing** | **0%** | **80%** |
| **Overall parse success** | **53.6%** | **89%** |
| Generations proceeding with empty `{}` | 46.4% | 11% |
| Calls hitting the cap | 96 of 224 | **0 of 37** |

Cost: **+1,759 output tokens across 37 parses = $0.0088**, or 3.8% of
parse-stage cost. At Config A's measured $0.02796 per generation this is roughly
a 0.9% increase in total cost per generation, in exchange for the JD analysis
actually reaching the generator.

### 8.4 What the fix does not solve

A residual ~11% of parses still fail, and **this is a different defect that the
token cap does not touch.** Evidence that it is unrelated to length or budget:

- The failures occur at 800–1,300 output tokens with `stop_reason: end_turn` —
  completing normally, far below the new cap. Zero calls hit 4,096.
- They are **stochastic, not fixture-specific**. Re-running a single failing
  fixture four times produced three successes and one failure at comparable
  token counts. The same JD both passes and fails.

So the parser intermittently emits JSON that `extractJsonValue` cannot balance.
Note also that such failures are reported as `truncated` when they are really
malformed output — `extractJsonValue` returns `truncated` for any value that
opens and never closes, which conflates "cut off" with "unbalanced". The
functional outcome is identical (the route collapses to `{}`), but the
diagnostic label is misleading, and it is the reason §4.2's truncation counts
should be read as "JSON extraction failures" rather than strictly "truncations".

The remedy is the retry the validator already had and the JD parse did not — see
§9.

---

## 9. Follow-up: JD-parse retry

The §8.4 residual — ~11% of parses emitting unbalanced JSON regardless of token
budget — was addressed by giving the JD parse the retry the validator already
had.

### 9.1 The change

`app/api/generate/route.ts` — the JD parse now uses `parseLlmJson` instead of
bare `parseJson`. On a parse failure the parser is called once more before the
result falls through to an empty analysis.

This is the same recovery the validator has used since it was written. The
asymmetry was not deliberate: the validator got `parseLlmJson` and the JD parse
did not, and because a failed JD parse degrades silently rather than surfacing
an error, nothing ever drew attention to the gap.

Token accounting sits inside the retried closure, so both attempts are counted
onto the `generations` row rather than under-reporting usage.

The harness mirrors the change (`scripts/benchmark/pipeline.ts`) with a distinct
`parse_retry` stage, so future benchmark runs continue to measure the real path
and can separate first-attempt from post-retry behaviour.

### 9.2 Measured effect

37 eligible fixtures × 2 passes = 74 parses, at cap 4096:

| | First attempt | With retry |
|---|---|---|
| Standard JDs | 91% | **100%** |
| Long JDs | 80% | **100%** |
| **Overall parse success** | **89.2%** (66/74) | **100%** (74/74) |
| Generations proceeding with empty `{}` | 8 | **0** |

Retries fired on 8 of 74 parses (10.8%) and recovered 8 of 8. No call hit the
4,096 cap.

### 9.3 What it costs

| | Value |
|---|---|
| Parse cost per parse | $0.00592 → $0.00689 (**+16.4%**, cap fix and retry combined) |
| Retry's share of parse-stage cost | 10.8% |
| Added cost per generation | ~$0.001 (**~+3.5%** of the $0.02796 measured in §2.1) |
| Mean parse latency | 8,076 ms → 9,341 ms |
| Latency of a retried parse | 18,675 ms (2× a single parse, as expected) |
| Added mean end-to-end latency | ~1,000 ms (**~+3.6%** of the 28,028 ms in §2.1) |

**The latency cost lands in the worst possible place and is worth stating
plainly.** The parse retry sits on the critical path *before* generation begins,
so on roughly 11% of requests the user waits an extra ~9 seconds before the
first token streams. That is a real regression in perceived responsiveness for
one request in nine.

It is still the right trade for this product. The alternative is what the
benchmark measured: generating a "tailored" document with no knowledge of the
job description, which is the one thing the product exists to do. A slower
correct answer beats a fast one that silently ignores the input.

If the latency becomes a problem, the fix is not to remove the retry — it is to
make the first attempt succeed more often (a more constrained parser prompt, or
structured outputs, neither of which was attempted here).

### 9.4 Combined effect of §8 and §9

| | Before both fixes | After both |
|---|---|---|
| Overall parse success | 53.6% | **100%** |
| Long JDs parsing | 0% | **100%** |
| **Generations running with no JD analysis** | **46.4%** | **0%** |
| Cost per generation | $0.02796 | ~$0.02893 (+3.5%) |
| Mean end-to-end latency | 28,028 ms | ~29,000 ms (+3.6%) |

### 9.5 Limits of this verification

- **n = 74 parses, 8 retry events.** Recovering 8 of 8 is encouraging but does
  not establish a 100% recovery rate. If first-attempt failures are independent
  at the observed p ≈ 0.108, the expected residual double-failure rate is
  p² ≈ **1.2%**, not zero. Observing zero in 74 samples is consistent with that.
  **The honest claim is "residual failures drop from ~11% to roughly 1%," not
  "parse failures are eliminated."**
- Independence across attempts is assumed, supported by §8.4's observation that
  the same fixture both passes and fails, but not formally tested.
- Same synthetic corpus as the rest of this document (§5.1). A real-JD corpus
  could have a different first-attempt failure rate, which would move both the
  residual and the cost of the retry.
- Measured on the parser only. The validator's identical truncation failures
  (11 during the benchmark run) were not addressed, and `MAX_TOKENS.validator`
  is still 1024 — the same value that proved too low for the parser. That is an
  open item, not a solved one.

---

## 10. Follow-up: validator token cap and the truncated/invalid relabel

Two changes, both closing items left open in §9.5.

### 10.1 `MAX_TOKENS.validator`: 1024 → 4096

Same defect class as the parser. `buildValidatorPrompt` asks for five dimension
scores plus an **unbounded issues array**, so validator output length scales with
how many problems it finds — the worst case is a heavily-flagged generation
rather than a long JD.

Baseline from the benchmark run: **15 of 293 validator calls (5.1%) hit the 1024
cap** with `stop_reason: max_tokens`. Broken down:

| Slice | At cap |
|---|---|
| exp1 Config A | 6 / 109 (5.5%) |
| exp1 Config B | 3 / 76 (3.9%) |
| version `bullets-v2` | 6 / 54 (11.1%) |
| version `bullets-v1` | 0 / 52 (0%) |

Worth recording because it contradicts an assumption made while investigating:
Config B's validator (Sonnet) flags roughly twice as many issues per generation
as Config A's, so it looked like the obvious source of the truncations. It was
not — **Config A truncated at a slightly higher rate than Config B**, and the
worst slice was `bullets-v2`. Issue count drives output length, but not so
cleanly that the config with more flags truncates more.

### 10.2 Verification (live API, same method as the parser fix)

74 generated documents from the benchmark run (`results/outputs-*.jsonl`, Config
A / exp1) were replayed through the real validator at the new cap, each paired
with a freshly parsed JD analysis. Replaying genuine generated output matters
here: validator output length depends on what it finds, so synthesised input
would not exercise the tail.

| | Result |
|---|---|
| Validations | 74 |
| First-attempt parse success | **74/74 (100%)** |
| Final success | 74/74 (100%) |
| Retries fired | **0** |
| Validation ended `unavailable` | **0** |
| **Hit the new 4096 cap** | **0** |
| Would have hit the old 1024 cap | 2 (2.7%) |

Output token distribution: min 129, median 525, p90 917, **max 1,081**. The
most-flagged validation (8 issues) produced 1,081 tokens.

Cost $0.00452 per validation, mean latency 5,599 ms. Total for the verification
run including JD parses: $0.59.

**Validator truncations dropped to zero, which is what this change set out to
do.** Two caveats on the strength of that claim:

- The replay's would-have-truncated rate (2.7%) is *lower* than the benchmark's
  Config A rate (5.5%). n is small in both; 2 of 74 against a true rate of 5.5%
  is unremarkable sampling variation. The replay also validates each stored
  output once rather than reproducing the full retry sequence, so it is not a
  like-for-like re-execution.
- **This is a smaller fix than the parser's.** The parser needed 1,506 tokens
  against a 1,024 cap — 47% over budget, failing 100% of long JDs. The validator
  peaked at 1,081 against the same cap, only 5.6% over. It was marginally
  under-provisioned, not badly so. 4096 leaves 3.8× headroom over the observed
  maximum.

Because the validator has always had a retry and fails closed, its truncations
were already the least damaging of the three failure modes found: they cost a
wasted call and, twice in the whole run, an ungraded generation.

### 10.3 `extractJsonValue`: truncated vs invalid

`extractJsonValue` reported **every** unbalanced value as `truncated`. That
conflated two different causes:

1. the model was genuinely cut off at `max_tokens`, stopping mid-token;
2. the model finished but emitted structurally broken JSON — most often an
   unescaped quote inside a string, which desynchronises the scanner's string
   tracking so that braces in string *content* get counted.

Both fail to parse, and no caller branches on `reason` — verified across all
seven routes that consume `parseJson`/`parseLlmJson`, every one of which checks
only `.ok`. **The change is purely diagnostic and cannot alter behaviour.**

It matters because the label points investigation in the wrong direction. §8.4
found parses failing at 800–1,300 tokens with `stop_reason: end_turn` and zero
calls near the cap, all reported as "truncated" — which would send anyone
reading the logs toward raising a token budget that was not the problem.

The fix distinguishes them structurally: a cut-off response stops mid-token, so
its last meaningful character is not a closing delimiter; a finished-but-
malformed response ends the way completed JSON ends. The comparison strips any
trailing code fence first, since models routinely wrap output in ```` ```json ````.

Covered by `scripts/check-llm-json.ts` (19 assertions, no test framework added):
happy paths including braces inside strings and escaped quotes; genuine
truncation cut off mid-string, after a comma, and inside a nested array;
and finished-but-malformed output that previously mislabelled as truncated.

**Consequence for §4.2's numbers.** Those counts were produced under the old
labelling and should be read as "JSON extraction failures", not strictly
truncations. The parser figures are largely safe — 96 of 224 parse calls carried
`stop_reason: max_tokens`, so those were real truncations — but the residual
~11% described in §8.4 was mislabelled and is now correctly reported as
`invalid`. Any future re-run will produce cleanly separated counts.

### 10.4 Remaining open items

- **The benchmark has not been re-run since any of these fixes.** §1–§7 describe
  the pre-fix pipeline. A post-fix re-run costs roughly $8 and about two hours.
- Config B remains an invalid *quality* control (§5.2); answering "did quality
  drop?" needs an experiment holding the validator fixed.
- The §4.3 mechanism (empty analysis scoring higher) is inferred from reading
  `buildValidatorPrompt`, not established by ablation.
- `PASS_THRESHOLD` / `MIN_DIMENSION_SCORE` are still dead constants whose values
  happen to match `resolveVerdict`.

---

## 11. Post-fix re-run (run 2)

Run 1 (§1–§7) measured a pipeline in which 46.4% of generations had no JD
analysis. This section re-measures the identical matrix against the fixed
pipeline. **§1–§10 are unchanged** — run 1 stands as the record of what the
broken pipeline did, and the delta between the runs is itself a result.

### 11.1 Methodology

Identical to run 1: same 40 fixtures (**fixture-set hash `783cd3c8ac5d3ede`,
verified byte-identical before the run**), same candidate resume (SHA-256
`b5b08bbebf682455`, verified separately — the fixture hash does not cover it),
same 4 passes plus the same prompt-version series, same seeded shuffle (seed
`20260805`), sequential execution, same pricing source, JD cache still bypassed.

Production deltas under test, all committed before the run:

| | run 1 | run 2 |
|---|---|---|
| `MAX_TOKENS.parser` | 1024 | **4096** |
| `MAX_TOKENS.validator` | 1024 | **4096** |
| JD parse recovery | none (`parseJson`) | **`parseLlmJson`, one retry** |
| `extractJsonValue` labels | all unbalanced → `truncated` | **`truncated` vs `invalid` distinguished** |

`MODELS`, `PROMPT_VERSIONS`, prompts, and `resolveVerdict` are unchanged.

**Run record.** 2026-08-07 14:01:49Z → 16:41:25Z, **2h 39m**, 924 API calls,
**actual spend $9.90**. The process was reaped by the environment four times;
checkpointing resumed from the completed (jd, config, run) tuples each time with
no lost work and no duplicated units, and the fixture hash was re-verified on
every resume.

**Cost vs estimate.** I estimated $8.50–9.80 analytically; actual was $9.90, 1%
above the top of that range. The harness's own single-JD pilot extrapolation said
$11.45 — the same method that overshot run 1 by 32%, and it overshot again by
14%. The analytical estimate built from measured per-call costs was the better
predictor, but I under-called it, for the reason in §11.4.

**Three schema deviations**, forced by the fixes and handled in the comparison
tooling rather than silently reconciled: run 2 emits distinct `parse_retry` and
`validate_parse_retry` stages where run 1 conflated things under
`validate_retry` (decomposed by arithmetic for run 1); run 2's
`validator_retried_parse` accumulates where run 1's was overwritten and
undercounted; and run 1 had no JD-parse retry to record at all.

### 11.2 JD-analysis blindness — the primary validation

| | run 1 | run 2 |
|---|---|---|
| Parse success | 120/224 (53.6%) | **219/224 (97.8%)** |
| **Generations running blind (`{}`)** | **104 (46.4%)** | **5 (2.2%)** |
| Long JDs (>13k chars) | 0/30 (0%) | **26/30 (87%)** |
| Standard JDs | 120/194 (62%) | **193/194 (99%)** |
| Failure reasons | `truncated` 101, `invalid` 3 | **`invalid` 5, `truncated` 0** |

The parse-recovery path fired **21 times and recovered 16 (76%)**.

**Residual blindness is 2.2%, not 0%.** My plan's success criterion said 0%;
§9.5 predicted ~1.2%. The measured value is 2.2% — above the prediction, below
the pre-fix 46.4%. All five residuals are double-failures where both attempts
produced unparseable JSON; three of the five are long JDs. **Reported as
measured: the fix reduces blindness by 95% but does not eliminate it.**

Note that **zero** residual failures are labelled `truncated` — every one is
`invalid`. The §10.3 relabel is doing exactly its job: these are malformed
outputs, not budget exhaustion, and under run 1's labelling they would have been
misreported as truncations pointing at a token cap that is now demonstrably not
the constraint.

### 11.3 Reliability

| | run 1 | run 2 |
|---|---|---|
| Total API calls | 799 | 924 |
| Terminal failures | 0 | **0** |
| Backoff retries (429/529/5xx) | 0 | **0** |
| **Parser calls at `max_tokens`** | **96** | **0** |
| **Validator calls at `max_tokens`** | **15** | **0** |
| Generate calls at `max_tokens` | 0 | 0 |
| **Validation ended `unavailable`** | **4** | **0** |
| Input-validation rejections | 18 | 18 |

Both token-cap fixes are fully effective at scale: **zero truncations on either
stage across 924 calls.** The fail-closed path never fired because nothing
reached it. As in run 1, no rate limiting or server errors occurred, so the
backoff machinery remains unexercised and this run says nothing about behaviour
under API pressure.

### 11.4 Routing cost and latency — the delta widened sharply

| | run 1 | run 2 |
|---|---|---|
| Config A cost/generation | $0.02796 | $0.03130 (**+11.9%**) |
| Config B cost/generation | $0.04643 | $0.07126 (**+53.5%**) |
| Config A mean latency | 28,028 ms | 31,987 ms (**+14.1%**) |
| Config B mean latency | 41,882 ms | 63,863 ms (**+52.5%**) |
| **A cheaper than B** | **39.8%** | **56.1%** |
| **A faster than B** | **33.1%** | **49.9%** |

Latency percentiles, run 2: A p50 33,367 / p90 46,510 / p95 48,705;
B p50 64,264 / p90 89,165 / p95 93,724.

**My prediction was wrong, and by a lot.** In §9.3 I predicted the fixes would
add roughly 3.5% cost and 3.6% latency **to both configs alike**. Actual: Config
A +11.9% / +14.1%, Config B **+53.5% / +52.5%**. I was wrong on magnitude for
both and wrong on the premise that the impact would be symmetric.

The reason is the finding: **run 1 systematically under-measured Config B
because 94% of its generations were blind.** Sonnet's parser truncated at 1,024
tokens on 95% of calls, so Config B's parse was artificially cheap; its validator
then received the same empty `{}`, had nothing to check, and produced short
output. Run 2's Config B parse generates 93,436 output tokens against run 1's
75,569, and its validate stage 72,586 against 56,995.

The dominant driver is the **retry rate**:

| Retry rate | run 1 | run 2 |
|---|---|---|
| Config A | 40.5% | 52.7% |
| Config B | **0.0%** | **54.1%** |

Config B never retried in run 1 because its blind validator passed 98.6% of
generations. With sight restored it fails and retries like Config A, adding a
generate + validate cycle to more than half its generations.

**The routing conclusion strengthens, but for a reason that is not to the
pipeline's credit.** Config A is now 56.1% cheaper rather than 39.8% — not
because Haiku got better, but because run 1 had been flattering Config B by
measuring a stage that was silently failing.

### 11.5 Quality — the headline drop is mostly sample composition

Headline movement, both configs, both exceeding the noise floor established from
run 1's own two runs (Config A ±0.239 mean, ±5.4pp pass):

| | run 1 | run 2 | Δ | vs noise |
|---|---|---|---|---|
| Config A mean | 7.929 | 7.580 | **−0.349** | exceeds |
| Config A pass rate | 75.7% | 59.5% | **−16.2pp** | exceeds |
| Config B mean | 7.841 | 7.492 | −0.349 | exceeds |
| Config B pass rate | 98.6% | 63.5% | **−35.1pp** | exceeds |

**Scores went down after fixing the bug. That is not a quality regression — it
is the measurement becoming honest, and the evidence for that is specific.**

Restricting run 1 to the subset that was *not* blind makes the comparison
like-for-like:

| Config A subset | n | mean | pass | **relevance** |
|---|---|---|---|---|
| run 1, blind (`{}`) generations | 17 | **8.776** | **100%** | **8.24** |
| run 1, populated generations | 57 | 7.671 | 68.4% | 6.39 |
| run 2 (97.8% populated) | 74 | 7.580 | 59.5% | 6.16 |

**The blind validator awarded relevance 8.24 to output it had no requirements to
judge against — against 6.39 when it could see them.** Those 17 generations
scored a perfect 100% pass rate. They inflated run 1's headline.

Like-for-like, populated vs populated:

- **mean 7.671 → 7.580 = −0.091, which is INSIDE the ±0.239 noise floor.** No
  detectable change in mean score.
- pass rate 68.4% → 59.5% = **−8.9pp, which still exceeds the 5.4pp noise
  floor** — about half the headline −16.2pp, but real.

Per-dimension movement corroborates the mechanism. For Config A, only the
JD-dependent dimensions fell; the three that do not depend on the JD analysis
held or rose:

| | specificity | **relevance** | authenticity | impact | clean |
|---|---|---|---|---|---|
| run 1 | 8.36 | 6.82 | 8.04 | 8.48 | 8.96 |
| run 2 | 8.23 | **6.16** | 8.24 | 8.55 | 9.05 |
| Δ | −0.13 | **−0.66** | +0.20 | +0.07 | +0.09 |

A grader that had simply become harsher across the board would have pushed every
dimension down. Relevance falling three times further than anything else, while
authenticity, impact and cleanliness rise, is what "the grader gained
information about relevance specifically" looks like.

**What this does not establish.** Both the generator's and the validator's
inputs changed at once, so this cannot separate "output quality is unchanged and
the grader got stricter" from "output changed too." The like-for-like mean being
inside noise is consistent with the former and is the most defensible reading,
but the clean experiment — hold the validator's analysis fixed, vary only the
generator's — was not run. The residual −8.9pp like-for-like pass-rate drop has
at least three candidate explanations (run 1's "populated" analyses may
themselves have been partial; the validator cap change lets it express longer
issue lists; ordinary cross-day drift) and this benchmark does not distinguish
them.

Config B's populated-only subset is n=4 and is too small to support any
comparison; it is excluded rather than reported.

### 11.6 Prompt-version series

| Version | run 1 mean | run 2 mean | run 1 pass | run 2 pass | run 1 flags/gen | run 2 flags/gen |
|---|---|---|---|---|---|---|
| `bullets-v1` | 8.054 | 7.589 | 75.7% | 73.0% | 2.76 | 2.65 |
| `bullets-v2` | 7.846 | 7.459 | 67.6% | 62.2% | 3.35 | 3.16 |
| `bullets-v3` (current) | 7.811 | 7.505 | 73.0% | 62.2% | 3.65 | 3.70 |

All three versions dropped by a similar amount (−0.47, −0.39, −0.31), and the
ordering is preserved in both runs: v1 highest mean, v2 lowest. **Re-measuring on
a pipeline where the JD analysis actually reaches the generator did not change
the conclusion — there is still no evidence that either documented prompt
"improvement" improved anything measurable.** The differences between versions
remain within the noise established in §3.3, and v3's stated goal (banning em
dashes) still targets something the validator does not score.

### 11.7 Before/after summary

| Metric | run 1 (pre-fix) | run 2 (post-fix) |
|---|---|---|
| Generations running blind | **46.4%** | **2.2%** |
| Long-JD parse success | 0% | 87% |
| Parser truncations | 96 | **0** |
| Validator truncations | 15 | **0** |
| Ungraded (fail-closed) generations | 4 | **0** |
| A cheaper than B | 39.8% | **56.1%** |
| A faster than B | 33.1% | **49.9%** |
| Config A cost/generation | $0.02796 | $0.03130 |
| Config A mean latency | 28.0s | 32.0s |
| Config A retry rate | 40.5% | 52.7% |
| Config A mean score | 7.929 | 7.580 |
| Config A mean score, like-for-like | 7.671 | 7.580 (inside noise) |
| Total spend | $7.56 | $9.90 |

### 11.8 What these numbers don't prove

Everything in §5 still applies. Restated for this run, plus what is new:

- **The corpus is still synthetic** and LLM-authored (§5.1). This remains the
  largest threat to external validity and applies to every number above.
- **Quality is still LLM-judged self-evaluation, not ground truth**, and in
  Config A the judge is Haiku grading Sonnet. No human read any output in either
  run. The §11.5 finding is that the grader's *information* changed; whether its
  *judgment* is any good is untested.
- **Config B is still not a valid quality control** (§5.2) — and run 2 makes this
  worse, not better: its validator changed from blind to sighted at the same time
  as everything else.
- **Latency is single-machine and client-side** (§5.4), and the cross-run
  comparison adds a problem the within-run comparison does not have: run 1 ran
  2026-08-06 03:32–05:35Z and run 2 ran 2026-08-07 14:01–16:41Z, on the same
  residential connection but a different day and time of day. "Config A is 49.9%
  faster than Config B" (measured within one interleaved run) is far stronger
  evidence than "Config B got 52.5% slower between runs," which mixes the
  pipeline change with a day of API-side and network drift.
- **Sample size unchanged**: 37 JDs × 2 runs per config, one candidate profile,
  one document type, one tone. No significance testing; the noise floor is an
  empirical two-run spread, not a confidence interval.
- **The 2.2% residual blindness was not diagnosed**, only counted. Five
  double-failures is too few to characterise.
- **The cost figures are cold-cache** (§5.10). Production skips the parse call on
  a repeat JD, and the parse stage is now more expensive than it was, so the gap
  between benchmark and production cost has widened.

### 11.9 Resume-ready claims

Each with its number and the specific hole an interviewer would go for.

**Claim 1 — the diagnostic-and-fix arc (lead with this).**

> "Instrumented an LLM generation pipeline and found 46% of requests silently
> running with an empty job-description analysis — a 1,024-token output cap was
> truncating the parser's JSON and the error path discarded the failure. Fixed
> the cap and added a recovery retry, taking blindness from 46.4% to 2.2% and
> parser truncations from 96 to 0 across 924 calls."

*Vulnerable to:* "how do you know the output was actually worse?" You don't —
see Claim 3. This is a defect with a quantified frequency and an identified
mechanism, not a measured quality regression. Say that before they ask.

**Claim 2 — routing cost.**

> "Measured the production model routing at 56% cheaper and 50% faster per
> generation than an all-Sonnet control, across 37 job descriptions with two runs
> per configuration and between-run variance under 5%."

*Vulnerable to:* "did quality drop?" The control's validator differs from
Config A's, so the quality comparison is invalid — concede it unprompted. Also
note the 56% figure is *larger* than the 39.8% first measured, because the first
measurement was flattering the control by measuring a silently-failing stage.

**Claim 3 — the measurement-honesty finding (the most interesting one).**

> "After fixing the bug, measured quality scores *fell* 16 points of pass rate.
> Showed this was the measurement correcting rather than the product regressing:
> the validator had been scoring 46% of generations without the requirements it
> was grading against, awarding those a relevance score of 8.24 versus 6.39 when
> it could see them. Comparing like-for-like, mean score moved 0.09 — inside the
> 0.24 run-to-run noise floor."

*Vulnerable to:* "you changed the generator's and the grader's inputs at the same
time, so how do you separate them?" You can't, fully. The per-dimension evidence
is strong — relevance fell 0.66 while authenticity, impact and cleanliness rose —
but the clean ablation wasn't run. Volunteer this; it's the difference between
sounding rigorous and sounding lucky.

**Claim 4 — a wrong prediction, owned.**

> "Predicted the fixes would add ~3.5% cost to both configurations. Actual was
> +11.9% and +53.5%. The asymmetry was the finding: the control had been cheap
> only because its parse stage was failing silently."

*Vulnerable to:* nothing much — it's a disclosed miss with the correct
post-hoc explanation. Volunteering a wrong prediction and what it taught you is
usually stronger than a clean win.

**Claim 5 — the negative result, twice.**

> "Re-ran three prompt versions against the same test set before and after the
> fix. Neither documented 'quality improvement' revision moved the pass rate in
> either run (v1 75.7%/73.0%, v2 67.6%/62.2%, v3 73.0%/62.2%, n=37 each,
> differences within noise)."

*Vulnerable to:* only if you overstate it. The right framing is "the changes
didn't move the metric I was measuring, and one of them targeted something the
validator doesn't score" — which shows you understand your instrument's limits.

**Do not claim** anything about output quality between configs; any
generalisation to real job postings; or that parse failures were eliminated —
2.2% remain.
