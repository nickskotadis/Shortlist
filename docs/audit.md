# Shortlist — Functional Inventory Audit

**Date:** 2026-07-16
**Scope:** Every user-facing route and major feature, assessed for *actual* state — not what the UI implies or the docs claim.
**Method:** Static tracing from user action → hook → API route → external service → result, cross-checked across five independent passes. Every claim is cited to `file:line`. Where a runtime library's behavior mattered (`pdf-parse`), it was verified against the published package on the npm registry.

**Verification caveats (read before trusting a "Working"):**
- Statuses are primarily from source tracing + package-registry inspection (`node_modules` is not installed locally). One real build **was** observed: a Vercel build of this branch (commit `1c7853d`) **compiled successfully and passed TypeScript**, then **failed at "Collecting page data" with `Error: supabaseUrl is required` at `/api/stripe/webhook`** — a module-scope Supabase client that throws when `NEXT_PUBLIC_SUPABASE_URL` is unset at build time (see §4). So: the codebase typechecks; the webhook route has a build-time crash when env is not present.
- Several features are real code that depends entirely on **deployment-time config** (Supabase provider toggles, Stripe env vars, Supabase Site URL). Those are marked "env-dependent" — the code works; whether the *deployment* works cannot be proven from the repo.
- `CLAUDE.md` is stale in at least two places (claims LinkedIn OAuth and a `pdf-parse` gotcha that no longer match the code). Treat the docs as intent, not evidence.

**Legend:** ✅ Working · 🟡 Partially working · 🔴 Broken · 🟦 Scaffolding only

---

## Route inventory (including routes not in the original list)

| Route | Status | Auth / gate | Demo-ready on a clean (logged-out) session |
|---|---|---|---|
| `/` | ✅ Working (static) | none | Yes |
| `/generate` | ✅ Working (the product) | none — works logged-out | **Yes** (streamed output) |
| `/auth/login` | ✅ Working | n/a | Yes, if Supabase configured |
| `/dashboard` | ✅ Working | redirect if logged-out | No (auth wall) |
| `/score` | ✅ Working | API 401 if logged-out; 1 free use | No cold; yes signed-in (once) |
| `/pricing` | ✅ Working | none to view | Yes to view |
| `/interview` | ✅ Working | Q-bank open; coach/mock Pro | Yes (Q-bank) |
| `/fit` | 🟡 Working but fragile | API 401 if logged-out; 1 free use | No cold; intermittent 500 risk |
| `/admin/quality` | ✅ Working | `ADMIN_EMAILS` only | No (admin only) |
| `/applications` **(not in original list)** | ✅ Working (CRUD) | redirect if logged-out | No (auth wall) |
| `/negotiate` **(not in original list)** | ✅ Working | Pro-only end to end | No (Pro gate) |
| `/privacy` **(not in original list)** | 🟡 Working, unfinished-looking | none | Yes (but off-theme + wrong contact) |

**No route is broken or scaffolding-only at the page level.** Every page is wired to a real API that calls Anthropic / Supabase / Stripe and returns real data. The breakage lives *below* the pages — in PDF parsing, one Chrome-extension board, fragile LLM JSON parsing, and a signup trigger — and in auth/tier walls that stop a cold stranger.

---

## 1. Web pages

### `/` — Landing · ✅ Working
- Static marketing. Renders `<Nav />` (`app/page.tsx:28`) + CTAs to `/generate` (`:59-67`, `:120-128`). The feature cards and "example output" bullets are **hardcoded copy** (`:4-23`), not generated — expected for a landing page.
- **Demo-ready:** Yes. "No account required to start" (`:68`) is accurate — see `/generate`.

### `/generate` — Main flow · ✅ Working (this is the real product)
- Server wrapper fetches plan + monthly usage + saved resume (`app/generate/page.tsx:19-48`), passes to `GenerateForm`. `useGenerate` POSTs `/api/generate` and consumes SSE (`hooks/useGenerate.ts:54-142`); rendered in `OutputPanel` (`GenerateForm.tsx:955`).
- **Works fully for logged-out users** — auth is optional (`app/api/generate/route.ts:127-131`); rate limit + DB save apply only to authed users.
- **Failure modes:** (a) PDF upload is broken — see §6; (b) export buttons 401 for logged-out users — see §5. Core generation is unaffected.
- **Demo-ready:** **Yes.** A stranger on a clean session gets real streamed output.

### `/auth/login` · ✅ Working (with a missing provider)
- Magic link via `signInWithOtp` (`app/auth/login/page.tsx:57-62`); OAuth via `signInWithOAuth` (`:39-49`).
- **`OAUTH_PROVIDERS` contains only Google and GitHub** (`:8-30`). **LinkedIn (`linkedin_oidc`) is absent** despite `CLAUDE.md` claiming it shipped. No password auth exists.
- **Demo-ready:** Yes for magic link + Google/GitHub — *if* the providers are enabled in the Supabase dashboard and Site/Redirect URLs point at prod. Not verifiable from the repo.

### `/dashboard` · ✅ Working
- Auth wall: `if (!user) redirect("/auth/login")` (`app/dashboard/page.tsx:13`). Fetches last 50 generations + plan + usage in parallel (`:19-38`), real Supabase data under RLS.
- **Demo-ready:** No for a cold stranger (redirect). A new authed user sees an empty state.

### `/score` · ✅ Working
- Server fetches `plan, score_count` (`app/score/page.tsx:14-22`); gate `plan !== "pro" && scoreCount >= 1` (`ScoreClient.tsx:105`). `/api/score` **requires auth** (401 → sign-in card). Free limit = 1, enforced with an atomic optimistic lock (`app/api/score/route.ts:70-81`).
- **Demo-ready:** Not cold (API rejects logged-out). Signed-in free user gets exactly one score, then a paywall.

### `/pricing` · ✅ Working
- Own inline nav. Prices are hardcoded display copy (`app/pricing/page.tsx:8-9`); real price IDs resolve server-side (`app/api/stripe/checkout/route.ts:42-45`). `handleUpgrade` → checkout → `window.location.href = data.url` (`pricing/page.tsx:50-78`).
- **Demo-ready:** Yes to view. Completing a purchase needs auth + configured Stripe (§4).

### `/interview` · ✅ Working
- **Question Bank** POSTs `/api/interview` — **no auth, no usage cap** (`InterviewClient.tsx:805`), real `InterviewPrepResult`. **Answer Coach** and **Mock Interview** are Pro-gated in UI and API.
- **Demo-ready:** Yes for Question Bank (works logged-out via paste). Coach/Mock require Pro.

### `/fit` · 🟡 Working but fragile
- Auth-gated (`app/api/fit/route.ts` → 401), free limit 1 via atomic claim (`:80-97`). Real 0–100 `FitScoreResult`.
- **Failure mode:** `FitScoreResult` is the largest structured payload in the app; commit `a60ba35` doubled `max_tokens` to 2048 because verbose Haiku output was truncating and breaking `JSON.parse` (`route.ts:110`). **2048 reduces but does not eliminate** the risk — a long resume + detailed JD can still truncate mid-JSON → 500, with no retry or repair. See §3 (systemic).
- **Demo-ready:** Not cold; intermittent 500 on large inputs even when signed in.

### `/admin/quality` · ✅ Working
- Gated by `ADMIN_EMAILS` env: `if (!user || !adminEmails.includes(user.email)) redirect("/")` (`app/admin/quality/page.tsx:11-18`). Aggregates up to 5000 generations by `prompt_version` + `ab_variant`. Real data.
- **Demo-ready:** No — admin-only, not in nav (intentional).

### `/applications` · ✅ Working (CRUD, not AI)
- Auth wall (`app/applications/page.tsx:9`). `/api/applications` GET/POST/PATCH under RLS, with `sanitizeUrl()` (rejects `javascript:`), status-enum validation, length caps (`route.ts:22-88`). No LLM call — pure database CRUD. (The AI follow-up email is a separate route, §3.)
- **Demo-ready:** No for cold stranger; empty list for a new authed user.

### `/negotiate` · ✅ Working — Pro only
- Immediate gate: unauth → sign-in card; authed non-Pro → upgrade card (`NegotiateClient.tsx:246-301`). `/api/negotiate` enforces auth (401) + Pro (403), sanitizes fields to 500 chars, Sonnet. Real `NegotiationResult`.
- **Failure mode:** second-most-fragile JSON parse (§3) — `NegotiationResult` is large and can approach `max_tokens: 2048` → truncation → 500.
- **Demo-ready:** No — Pro-gated end to end.

### `/privacy` · 🟡 Working, unfinished-looking
- Complete static policy, no auth. **Two visible defects:** (1) **not migrated to the dark theme** — still `bg-slate-50`/`bg-white`/`text-slate-900` (`app/privacy/page.tsx:10-24`), visually inconsistent with every other page; (2) **contact mismatch** — anchor is `mailto:nick@getshortlist.io` but the visible text is `nickskotadis@gmail.com` (`:165-170`).
- **Demo-ready:** Renders, but looks half-finished; don't put it on screen.

### Navigation wiring
- `NAV_LINKS` render **only when logged in** (`components/Nav.tsx:47-68`). A logged-out visitor sees only the brand + "Sign in" — every feature page is reachable only via landing CTAs or a direct URL. A global `Footer` provides LinkedIn/GitHub/Privacy/Pricing links (`components/Footer.tsx`).

---

## 2. Supabase auth flows

| Method | Status | Notes |
|---|---|---|
| Email magic link / OTP | ✅ code Working | `signInWithOtp` (`login/page.tsx:57-62`); callback `verifyOtp` (`callback/route.ts:52-60`). Needs Supabase Site/Redirect URLs set for prod or links point at localhost. |
| Password | — Not offered | No password field, no `signInWithPassword` anywhere. |
| Google OAuth | 🟡 code Working, config-dependent | Real `signInWithOAuth` (`:39-49`); dead-ends unless enabled in Supabase dashboard. |
| GitHub OAuth | 🟡 code Working, config-dependent | Same path, `provider: "github"`. |
| **LinkedIn OAuth** | 🔴 **Absent** | Documented as shipped; **not in the code** (`login/page.tsx:8-30`). Doc/reality mismatch. |

- **OAuth callback code exchange · ✅ Working** — builds `redirectResponse` first, wires `setAll` → `redirectResponse.cookies.set`, then `exchangeCodeForSession` (`callback/route.ts:27-49`). Open-redirect guard on `next` (`:11-12`); `x-forwarded-host` restricted to `*.vercel.app` (`:14-20`).
- **Route protection (`proxy.ts`) · ✅ Working, narrow** — refreshes sessions everywhere but **only `/dashboard` is access-gated** (`proxy.ts:33-37`). `/generate`, `/applications`, `/fit`, `/score`, `/interview`, `/negotiate` rely on per-route API checks, not middleware.
- **Profile-on-signup trigger · ⚠️ Risk** — `handle_new_user()` in `supabase/schema.sql:51-58` is `SECURITY DEFINER` but **lacks `SET search_path = public` and does not schema-qualify `public.profiles`** — the exact anti-pattern `CLAUDE.md`'s own gotchas say causes "Database error saving new user." A later migration fixes a *different* trigger, but this one as written in the repo is the risky form. If the live DB runs this version, **new signups can fail at the trigger.** Not confirmable from the repo — flag as a real risk, not a confirmed break.

---

## 3. LLM pipeline (end to end)

**No mock or hardcoded LLM responses exist anywhere.** Every AI route calls a real Anthropic model with correct routing (Sonnet for generation, Haiku for parsing/short tasks per `lib/constants.ts:1-5`). The systemic weakness is **fragile single-shot JSON parsing**.

### Core generate → validate → retry · ✅ Working (real)
- Real SSE token streaming from Sonnet (`app/api/generate/route.ts:276-299` → `hooks/useGenerate.ts:108-110`).
- Real Haiku validator scoring 5 dimensions + hallucination detection (`route.ts:304-338`; `lib/prompts.ts:403-486`); one retry if verdict ≠ PASS (`MAX_RETRIES=1`, `constants.ts:60`), verdict recomputed server-side against thresholds (`prompts.ts:518-531`). Max 2 attempts.
- All **5 `DocumentType` values** (`bullets`, `summary`, `cover_letter`, `linkedin_about`, `linkedin_headline`) are handled in `VALID_DOC_TYPES`, the `buildPrompt()` switch (`route.ts:250-269`), and `PROMPT_VERSIONS` (`constants.ts:9-24`). No fall-through.
- **`maxDuration` present on every LLM route** (generate/interview/mock/negotiate = 60; score/fit/evaluate/follow-up = 30). None missing.
- **No PII logging** — grep for `console.*` over `candidate_input|jd_text|resume_text|user_answer` is empty; `input_snapshot` stores only word counts + a boolean (`route.ts:384-390`).
- **⚠️ Validator fails OPEN:** if the validator's JSON fails to parse, it **defaults to a fabricated PASS** (`route.ts:327-335`, `reason: "Validator parse failed"`). A malformed validator response silently ships unvalidated content. Don't over-claim "every output is quality-gated."

### Per-endpoint

| Endpoint | Status | Model | Notes / failure mode |
|---|---|---|---|
| `/api/generate` | ✅ Working | Sonnet | Core pipeline above. |
| `/api/score` | ✅ Working | Haiku | Small payload; single-shot `JSON.parse` (`route.ts:95`) → 500 on malformed, but low truncation risk. |
| `/api/fit` | 🟡 Fragile | Haiku | **Largest payload; highest breakage risk.** `a60ba35` bumped `max_tokens` to 2048; still can truncate → `JSON.parse` 500 (`route.ts:110`). No repair/retry; `stripCodeFences` doesn't tolerate prose preambles. |
| `/api/negotiate` | 🟡 Fragile | Sonnet | Second-worst: large `NegotiationResult` near `max_tokens: 2048` → truncation 500 (`route.ts:119`). Pro-gated. |
| `/api/interview` | 🟡 Abuse vector | Haiku | Works, but **only unauthenticated LLM route — no auth, no rate limit, no cooldown**, 4096 output tokens. Anyone can burn tokens repeatedly. |
| `/api/interview/mock` | ✅ Working | Sonnet | Multi-turn array correctly anchored; `turn` returns raw text (robust), `debrief` JSON-parses (`route.ts:145`). Pro-gated. |
| `/api/interview/evaluate` | ✅ Working | Haiku | Auth + Pro; answer validated 10–3000 chars; single-shot parse. |
| `/api/follow-up` | ✅ Working | Haiku | Auth + 30s per-user cooldown; returns raw text (no JSON parse) → **most robust** AI route. |
| `/api/applications` | ✅ Working | — | **Not AI** — pure CRUD. |

**Systemic finding:** 7 routes do `JSON.parse(stripCodeFences(raw))` in one try/catch with no repair, no retry, no prose tolerance. Any leading/trailing prose or `max_tokens` truncation is a hard 500 (or, uniquely in generate, a fail-open fake PASS). Risk order: **fit > negotiate > mock-debrief / interview-prep > score / evaluate.**

---

## 4. Stripe (checkout + webhook + portal)

**The full loop is real code with no stubs**, but entirely env/dashboard-dependent.

- **Checkout · ✅ Working** — auth-gated (`checkout/route.ts:11-13`); price IDs resolved **server-side** from env, never from client (`:42-49`); real `checkout.sessions.create`, `mode: "subscription"`, `client_reference_id: user.id` (`:61-71`). Returns 500 if a price env is unset.
- **Webhook · ✅ Working** — raw body via `req.text()` + signature verification (`webhook/route.ts:13,22`); service-role `@supabase/supabase-js` client (`:2,7-10`); handles `checkout.session.completed` (sets `plan: "pro"` + `stripe_customer_id`), `subscription.updated`, `subscription.deleted`. **DB errors throw → 500 so Stripe retries** (`:76-79`).
- **Portal · ✅ Working** — requires `stripe_customer_id`, creates a real billing-portal session (`portal/route.ts:39-44`).
- **Free/Pro state** — source of truth is `profiles.plan`, flipped only by the webhook. Free monthly cap (=2) enforced **before** the stream in `generate/route.ts:133-157`. **Gap:** the cap is inside `if (user)` (`:134`) — **anonymous users are never rate-limited**, so the free cap is bypassable by logging out.
- ✅ **FIXED — Build-time crash** (was 🔴): the service-role client was instantiated at **module scope**, so `next build` evaluated it during "Collecting page data" and failed with `Error: supabaseUrl is required` when `NEXT_PUBLIC_SUPABASE_URL` was unset. Now lazy via `getSupabaseAdmin()` called inside `POST` (`webhook/route.ts:7-24`), mirroring `getStripe()`. **Verified:** `next build` with `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` unset now completes and collects page data for `/api/stripe/webhook`.
- **Silent failure mode:** if `STRIPE_WEBHOOK_SECRET` is misconfigured (the documented trailing-newline hazard), checkout still opens but the plan **never upgrades** — "paid but still free." Not verifiable from the repo.
- Minor: checkout/portal use `x-forwarded-host` unvalidated (`checkout/route.ts:31`), unlike the `*.vercel.app` restriction in the auth callback.

---

## 5. Export — DOCX / PDF / ZIP

Real libraries (`docx@9.6`, `@react-pdf/renderer@4.3`, `jszip@3.10`), real binary output, correct headers. **All export routes require auth** (`export/route.ts:21-28`) — but the UI shows export buttons to logged-out users, so an anonymous user who generates then clicks Export gets a 401 → "Export failed" (`OutputPanel.tsx:334-336`).

| Format | Status | Evidence |
|---|---|---|
| DOCX | ✅ Working | `lib/export.ts:26-87`, real `Packer.toBuffer`; `Content-Type` + disposition + length correct (`export/route.ts:103-118`). Wired in `OutputPanel.tsx:566-573` and dashboard cards. |
| PDF | ✅ Working | `lib/export.ts:134-180`, real `renderToBuffer`; `serverExternalPackages` includes `@react-pdf/renderer` + `canvas` (`next.config.ts:5`). |
| ZIP | ✅ Working (design note) | `export/route.ts:44-82`; JSZip `arraybuffer` gotcha handled; ≤10-doc cap. **ZIP always packs DOCX only** (`:64-65`), never PDF, despite being called an "application package." Batch mode is **Pro-gated**, so ZIP is Pro-only. |

**Demo-ready:** Yes for a signed-in user. A cold stranger's export 401s.

---

## 6. Resume parsing from PDF/DOCX upload

Upload UI is wired on four pages (`GenerateForm.tsx:510`, `ScoreClient.tsx:153`, `FitClient.tsx:279`, `InterviewClient.tsx:836`), all feeding extracted text into live state that drives generation. Validation is solid: auth required, 5 MB cap, magic-byte anti-spoof, empty-text → 422 (`parse-resume/route.ts:8-38`).

| Path | Status | Evidence |
|---|---|---|
| **PDF upload** | 🔴 **BROKEN** | `package.json` pins **`pdf-parse@2.4.5`**, but `parse-resume/route.ts:46-49` calls the **v1 callable API** (`pdfParse(buffer)`). Verified against the published 2.4.5 package: it exports a **`PDFParse` class only — no callable default** (correct usage is `new PDFParse({ data: buffer }).getText()`). So `(mod).default ?? mod` resolves to a non-callable object → `TypeError` → caught at `:74-78` → **500 on every PDF upload**, across Generate, Score, Fit, and Interview. Masked at build time by the stale `@types/pdf-parse@1` (v1 signature) + the `as any` cast. |
| DOCX upload | ✅ Working | `mammoth.extractRawText({ buffer })` (`route.ts:57-67`) — correct current API. |
| Save master resume | ✅ Working | `profile/resume` GET/PUT stores `profiles.resume_text`, auth-gated, 20k cap (`route.ts:47-58`) — no parsing involved. |

**This is the single highest-impact confirmed bug** — PDF is the more common resume format, and every PDF upload currently fails. Fix is a rewrite to the v2 `PDFParse` class API.

---

## 7. Chrome extension (per job board)

**One functional mechanism, no API integration.** `content.js` injects a floating button; on click it scrapes JD text via DOM selectors and `window.open`s `https://shortlist-amber.vercel.app/generate?jd=<encoded>` (`content.js:144-158`). **No API call, no auth, no session sharing, no `chrome.storage`.** The 12k-char slice (`content.js:156`) fits under the app's 20k `?jd=` cap (`GenerateForm.tsx:442-444`), so the hand-off path itself works. Whether the button appears is gated by `manifest.json` `matches`; extraction quality is gated by the per-board selector.

| Board | Status | Root cause |
|---|---|---|
| Greenhouse | 🟡 Partial | Injects on classic `boards.greenhouse.io`; **misses modern `job-boards.greenhouse.io`** (path doesn't match `*.greenhouse.io/jobs/*`, `manifest.json:34`) and embedded iframes (`all_frames` unset). Named selectors (`content.js:19-27`) look stale → likely falls to generic fallback. |
| Lever | 🟡 Partial | `jobs.lever.co` matches and injects, but `.posting-requirements` / first `<section>` (`content.js:30-35`) capture only a **fragment** of the JD. |
| **Workday** | 🔴 **Broken** | Real reqs live at tenant subdomains (`company.wd5.myworkdayjobs.com`); manifest has `myworkdayjobs.com/*` with **no `*.myworkdayjobs.com`** (`manifest.json:36`), so the script **never injects** — the one genuinely-correct selector (`[data-automation-id='jobPostingDescription']`) never runs. |
| Indeed | 🟡 Partial | Correct selector `#jobDescriptionText` (`content.js:48-53`), but match is limited to legacy `www.indeed.com/viewjob*` — misses the modern `?vjk=` pane and all international hosts. |
| LinkedIn | 🟡 Partial | Plausible selectors + SPA re-injection (`content.js:57-63,178-185`), but matches only `/jobs/view/*` — misses the `/jobs/search/?currentJobId=` pane; classes are rotated/obfuscated; JD often collapsed behind "see more." |

**Cross-cutting extension defects:**
- **`popup.html` "Open Shortlist" button is dead** — behavior is an **inline `<script>`** (`popup.html:151-155`), blocked by MV3's default `script-src 'self'` CSP. And it wouldn't extract a JD anyway (opens a blank `/generate`).
- **`background.js` is dead code** — the `chrome.action.onClicked` handler body is `if (!tab.id) return;` (`:4-8`), and `onClicked` never fires while `default_popup` is set. No message passing, no API, no auth.
- **Unused permissions** — `scripting`, `activeTab`, `storage` are declared (`manifest.json:9`) but never used → Chrome Web Store rejection risk.
- A stray untracked **`shortlist-extension.zip`** sits in the repo root (in sync with the source, but binary + untracked).

---

## Bottom line — three lists

### ✅ Works and demos well (survives a stranger, live, unprompted)
- **Core generation (`/generate`)** — real SSE streaming from Sonnet, real validate + one retry, works **logged-out**. This is the product and it holds up. *(One caveat: don't upload a PDF or click Export while logged out on stage.)*
- **Interview Question Bank (`/interview`)** — real Haiku output, no auth, no cap. Cold-stranger safe.
- **Landing (`/`)** and **Pricing (`/pricing`)** — polished, static, safe to show.
- **DOCX & PDF export** — real binaries with correct headers, *for a signed-in user*.
- **Dashboard (`/dashboard`)** and **Applications tracker (`/applications`)** — real Supabase-backed data/CRUD, *for a signed-in user with data*.
- **Stripe checkout → webhook → Pro** — real, complete loop *if env is configured* (can't prove from repo).

### 🟡 Works but shouldn't be shown (real, but gated, fragile, or visibly unfinished)
- **`/fit`** — works, but intermittently **500s on long inputs** (JSON truncation) and burns the 1 free use behind a paywall. High risk of failing live.
- **`/negotiate`, Mock Interview, Answer Coach** — real but **Pro-only end to end**; a cold stranger can't reach them, and negotiate shares the truncation-500 risk.
- **`/score`** — works, but auth-gated + 1 free use, then paywall.
- **ZIP export** — Pro-only, and packs **DOCX only** while calling itself an "application package."
- **Chrome extension on Greenhouse / Lever / Indeed / LinkedIn** — partial: may silently fail to inject or grab only a fragment. A live demo can no-op unpredictably.
- **`/privacy`** — off-theme and shows the wrong contact address; looks half-finished.
- **"Quality-gated output" as a claim** — the validator **fails open** to a fake PASS on a parse error; the gate is real but not airtight.
- **`/admin/quality`** — real and useful, but admin-only; not a public demo.

### 🔴 Cut or rebuild (broken, or claimed-but-absent)
- **PDF resume upload** — **broken on every PDF** across 4 pages (`pdf-parse` v1 API against a v2 package, `parse-resume/route.ts:46-49`). Rebuild to `new PDFParse({ data }).getText()`. Do **not** claim "PDF resume upload" until fixed.
- **Chrome extension — Workday** — **never injects** (subdomain match gap, `manifest.json:36`). Either fix the match patterns or drop Workday from the supported-boards claim.
- **Chrome extension — popup button + `background.js`** — dead under MV3 (inline-script CSP; suppressed `onClicked`). Rebuild the popup with an external `popup.js`; cut the empty service worker.
- **Chrome extension — unused `scripting`/`activeTab`/`storage` permissions** — cut before any Web Store submission.
- **LinkedIn OAuth** — documented as shipped but **not in the code**. Either implement it or stop claiming it (and fix `CLAUDE.md`).
- **`handle_new_user()` signup trigger** — missing `SET search_path` / schema-qualification (`schema.sql:51-58`); the project's own gotchas say this breaks signup. Verify against the live DB and rebuild if it matches the repo.
- **`/api/interview`** — the only unauthenticated LLM route (4096-token Haiku, no throttle). Add auth/rate-limiting or accept it as a standing cost/abuse exposure.
- ~~**Stripe webhook module-scope Supabase client**~~ — ✅ **FIXED** (§4): now lazy via `getSupabaseAdmin()` inside `POST`; `next build` succeeds with the Supabase env vars unset.

---

### Résumé-claim guidance (blunt)
Safe to claim without qualification: **an authenticated, streaming, self-critiquing LLM generation pipeline (generate → validate → retry) on Claude Sonnet/Haiku with SSE**, **Stripe subscription billing with webhook-driven entitlement**, **Supabase auth + RLS**, and **server-side DOCX/PDF/ZIP export**. Claim with care or fix first: **PDF resume ingestion** (broken), **the Chrome extension** (one board broken, popup dead, several boards fragile), and **LinkedIn sign-in** (absent). The breadth of features is real; the reliability of the *edges* is where a live demo or a technical interviewer will catch a gap.
