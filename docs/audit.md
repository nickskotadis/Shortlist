# Shortlist — Functional Inventory Audit

**Date:** 2026-07-16
**Scope:** Every user-facing route and major feature, assessed for *actual* state — not what the UI implies or the docs claim.
**Method:** Static tracing from user action → hook → API route → external service → result, cross-checked across five independent passes. Every claim is cited to `file:line`. Where a runtime library's behavior mattered (`pdf-parse`), it was verified against the published package on the npm registry.

**Verification caveats (read before trusting a "Working"):**
- Statuses are primarily from source tracing + package-registry inspection (`node_modules` is not installed locally). One real build **was** observed: a Vercel build of this branch (commit `1c7853d`) **compiled successfully and passed TypeScript**, then **failed at "Collecting page data" with `Error: supabaseUrl is required` at `/api/stripe/webhook`** — a module-scope Supabase client that throws when `NEXT_PUBLIC_SUPABASE_URL` is unset at build time (see §4). So: the codebase typechecks; the webhook route has a build-time crash when env is not present.
- Several features are real code that depends entirely on **deployment-time config** (Supabase provider toggles, Stripe env vars, Supabase Site URL). Those are marked "env-dependent" — the code works; whether the *deployment* works cannot be proven from the repo.
- The original audit found `CLAUDE.md` stale in two places (a LinkedIn OAuth claim and a `pdf-parse` gotcha). Both are now reconciled: LinkedIn was deliberately dropped and the doc updated; PDF parsing was moved off `pdf-parse` to `unpdf` (serverless-safe) and the gotcha rewritten.

**Legend:** ✅ Working · 🟡 Partially working · 🔴 Broken · 🟦 Scaffolding only

> **Remediation pass (2026-07-16):** the P0/P1/P2 defects below were fixed on branch `worktree-audit-inventory` — one commit per item, each verified as noted inline (typecheck + targeted end-to-end tests; a full `next build` with all env vars unset now exits 0). Items that require access this environment doesn't have (production DB, provider dashboards, loading the extension unpacked) are **not** marked done — see **[Needs manual verification](#needs-manual-verification)** at the end.

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
- **Failure modes (all since fixed):** (a) PDF upload was broken and (b) auth-walled for anonymous users — see §6; (c) export buttons 401'd for logged-out users — see §5. Core generation is unaffected.
- **Demo-ready:** **Yes.** A stranger on a clean session gets real streamed output.

### `/auth/login` · ✅ Working (with a missing provider)
- Magic link via `signInWithOtp` (`app/auth/login/page.tsx:57-62`); OAuth via `signInWithOAuth` (`:39-49`).
- **`OAUTH_PROVIDERS` contains Google and GitHub** — the intended final auth surface (Google + GitHub + magic link). LinkedIn OIDC was evaluated and **deliberately excluded**; `CLAUDE.md` is now consistent. No password auth exists (by design).
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

### `/privacy` · ✅ Working (was 🟡)
- Complete static policy, no auth. ✅ **FIXED:** migrated to the dark palette (`var(--color-*)` — `page`/`surface`/`border`/`text-*`/`separator`, indigo-400 links) so it matches every other page; and the **contact mismatch is resolved** — the `mailto:` now matches the visible `nickskotadis@gmail.com`. **Verified:** no residual `slate-*`/`bg-white`/`indigo-600` classes; `tsc` clean.
- **Demo-ready:** Yes.

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
| **LinkedIn OAuth** | ✅ **RESOLVED** (was 🔴 doc/reality mismatch) | Decision reversed: LinkedIn OIDC is **deliberately not part of the auth surface**. The `linkedin_oidc` button was removed from `OAUTH_PROVIDERS` and the claim removed from `CLAUDE.md`, so code and docs now agree. **Final auth surface: Google + GitHub + magic link.** No manual provider setup needed. |

- **OAuth callback code exchange · ✅ Working** — builds `redirectResponse` first, wires `setAll` → `redirectResponse.cookies.set`, then `exchangeCodeForSession` (`callback/route.ts:27-49`). Open-redirect guard on `next` (`:11-12`); `x-forwarded-host` restricted to `*.vercel.app` (`:14-20`).
- **Route protection (`proxy.ts`) · ✅ Working, narrow** — refreshes sessions everywhere but **only `/dashboard` is access-gated** (`proxy.ts:33-37`). `/generate`, `/applications`, `/fit`, `/score`, `/interview`, `/negotiate` rely on per-route API checks, not middleware.
- **Profile-on-signup trigger · ✅ FIXED + APPLIED to production** — `handle_new_user()` now pins `SET search_path = public` and inserts into `public.profiles` (`schema.sql`), matching the proven pattern in `migration_003`. `migration_009.sql` re-creates the function safely via `CREATE OR REPLACE` (the existing `on_auth_user_created` trigger keeps pointing at it — no drop/recreate). **`migration_009.sql` has been run against the production DB by the owner** — the signup-break risk is closed.

---

## 3. LLM pipeline (end to end)

**No mock or hardcoded LLM responses exist anywhere.** Every AI route calls a real Anthropic model with correct routing (Sonnet for generation, Haiku for parsing/short tasks per `lib/constants.ts:1-5`). The systemic weakness is **fragile single-shot JSON parsing**.

### Core generate → validate → retry · ✅ Working (real)
- Real SSE token streaming from Sonnet (`app/api/generate/route.ts:276-299` → `hooks/useGenerate.ts:108-110`).
- Real Haiku validator scoring 5 dimensions + hallucination detection (`route.ts:304-338`; `lib/prompts.ts:403-486`); one retry if verdict ≠ PASS (`MAX_RETRIES=1`, `constants.ts:60`), verdict recomputed server-side against thresholds (`prompts.ts:518-531`). Max 2 attempts.
- All **5 `DocumentType` values** (`bullets`, `summary`, `cover_letter`, `linkedin_about`, `linkedin_headline`) are handled in `VALID_DOC_TYPES`, the `buildPrompt()` switch (`route.ts:250-269`), and `PROMPT_VERSIONS` (`constants.ts:9-24`). No fall-through.
- **`maxDuration` present on every LLM route** (generate/interview/mock/negotiate = 60; score/fit/evaluate/follow-up = 30). None missing.
- **No PII logging** — grep for `console.*` over `candidate_input|jd_text|resume_text|user_answer` is empty; `input_snapshot` stores only word counts + a boolean (`route.ts:384-390`).
- ✅ **FIXED — Validator now fails CLOSED:** the validator parses via `parseLlmJson` (robust extraction + one retry). If it still can't be read, the route **no longer fabricates a PASS** — it returns `unavailable: true`, skips the generation retry (an ungraded output can't inform one), stores `null` validator scores/verdict in the DB, and emits `validation_unavailable` on the `done` SSE event. `OutputPanel` shows a **neutral "Not graded" badge** (not a fake pass, not a scary error); the generated text is unchanged. Threaded through single + batch flows. **Verified:** `tsc` clean; a stubbed-LLM test confirms `parseLlmJson` retries once, fails on persistent garbage (→ unavailable path), and recovers on a transient failure.

### Per-endpoint

| Endpoint | Status | Model | Notes / failure mode |
|---|---|---|---|
| `/api/generate` | ✅ Working | Sonnet | Core pipeline above. |
| `/api/score` | ✅ Working | Haiku | Small payload; single-shot `JSON.parse` (`route.ts:95`) → 500 on malformed, but low truncation risk. |
| `/api/fit` | ✅ FIXED (was 🟡) | Haiku | Now parses via `parseLlmJson` (`lib/llm-json.ts`): extracts JSON from prose/fences, detects truncation, and **retries the model once** before a structured error. |
| `/api/negotiate` | ✅ FIXED (was 🟡) | Sonnet | Same robust parse + one retry. Pro-gated. |
| `/api/interview` | ✅ Working (rate-limited) | Haiku | Still unauthenticated by design, but now **IP rate-limited** (`INTERVIEW_IP_LIMIT` = 10/hr/IP via `lib/rate-limit.ts`) so the 4096-token call can't be scripted into unbounded spend. |
| `/api/interview/mock` | ✅ Working | Sonnet | Multi-turn array correctly anchored; `turn` returns raw text (robust), `debrief` JSON-parses (`route.ts:145`). Pro-gated. |
| `/api/interview/evaluate` | ✅ Working | Haiku | Auth + Pro; answer validated 10–3000 chars; single-shot parse. |
| `/api/follow-up` | ✅ Working | Haiku | Auth + 30s per-user cooldown; returns raw text (no JSON parse) → **most robust** AI route. |
| `/api/applications` | ✅ Working | — | **Not AI** — pure CRUD. |

**Systemic finding — ✅ FIXED:** the six dedicated structured routes (`fit`, `negotiate`, `score`, `interview`, `interview/evaluate`, `interview/mock` debrief) now parse via a shared `parseLlmJson` in `lib/llm-json.ts` — it strips fences, extracts the outermost balanced JSON value from surrounding prose (string/escape-aware), distinguishes truncation from malformed output, and **retries the LLM call once** on parse failure before returning a structured error. Also hardened the `content[0]` empty-array access in each. **Verified:** 9-case unit test (prose preamble, trailing prose, fences, arrays, string-with-braces, truncation, empty, invalid) all pass; `tsc` clean. (Generate's own parses — JD analysis + validator — are handled in §3-core / §5, since the validator additionally must fail *closed*.)

---

## 4. Stripe (checkout + webhook + portal)

**The full loop is real code with no stubs**, but entirely env/dashboard-dependent.

- **Checkout · ✅ Working** — auth-gated (`checkout/route.ts:11-13`); price IDs resolved **server-side** from env, never from client (`:42-49`); real `checkout.sessions.create`, `mode: "subscription"`, `client_reference_id: user.id` (`:61-71`). Returns 500 if a price env is unset.
- **Webhook · ✅ Working** — raw body via `req.text()` + signature verification (`webhook/route.ts:13,22`); service-role `@supabase/supabase-js` client (`:2,7-10`); handles `checkout.session.completed` (sets `plan: "pro"` + `stripe_customer_id`), `subscription.updated`, `subscription.deleted`. **DB errors throw → 500 so Stripe retries** (`:76-79`).
- **Portal · ✅ Working** — requires `stripe_customer_id`, creates a real billing-portal session (`portal/route.ts:39-44`).
- **Free/Pro state** — source of truth is `profiles.plan`, flipped only by the webhook. Free monthly cap (=2) enforced **before** the stream in `generate/route.ts`. ✅ **FIXED — anonymous cost exposure:** the authed cap is inside `if (user)`, but the `else` branch now applies an **IP rate limit** to logged-out generation (`ANON_GENERATE_LIMIT` = 5/hr/IP via `lib/rate-limit.ts`) — logged-out generation stays available (deliberate) but is bounded per IP. **Verified:** unit test on the limiter's in-memory fallback caps at N and isolates keys; `tsc` clean.
- ✅ **FIXED — Build-time crash** (was 🔴): the service-role client was instantiated at **module scope**, so `next build` evaluated it during "Collecting page data" and failed with `Error: supabaseUrl is required` when `NEXT_PUBLIC_SUPABASE_URL` was unset. Now lazy via `getSupabaseAdmin()` called inside `POST` (`webhook/route.ts:7-24`), mirroring `getStripe()`. **Verified:** `next build` with `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` unset now completes and collects page data for `/api/stripe/webhook`.
- **Silent failure mode:** if `STRIPE_WEBHOOK_SECRET` is misconfigured (the documented trailing-newline hazard), checkout still opens but the plan **never upgrades** — "paid but still free." Not verifiable from the repo.
- ✅ **FIXED — Minor:** checkout/portal now validate `x-forwarded-host` against the same `/^[a-z0-9-]+\.vercel\.app$/` pattern as the auth callback; an unrecognized/spoofed host falls back to localhost (dev) or the canonical URL instead of being trusted. **Verified:** `tsc` clean; logic mirrors `auth/callback`.

---

## 5. Export — DOCX / PDF / ZIP

Real libraries (`docx@9.6`, `@react-pdf/renderer@4.3`, `jszip@3.10`), real binary output, correct headers. **All export routes require auth** (`export/route.ts:21-28`). ✅ **FIXED — logged-out export UX:** `OutputPanel` now takes an `isAuthenticated` prop (threaded from `GenerateForm` via `userEmail`); logged-out users see a **"Sign in to export DOCX / PDF"** link to `/auth/login` instead of dead buttons that 401. Applied to both single and batch panels. **Verified:** `tsc` clean; the two buttons are replaced by the sign-in link only when `!isAuthenticated`.

| Format | Status | Evidence |
|---|---|---|
| DOCX | ✅ Working | `lib/export.ts:26-87`, real `Packer.toBuffer`; `Content-Type` + disposition + length correct (`export/route.ts:103-118`). Wired in `OutputPanel.tsx:566-573` and dashboard cards. |
| PDF | ✅ Working | `lib/export.ts:134-180`, real `renderToBuffer`; `serverExternalPackages` includes `@react-pdf/renderer` + `canvas` (`next.config.ts:5`). |
| ZIP | ✅ Working | `export/route.ts:44-90`; JSZip `arraybuffer` gotcha handled; ≤10-doc cap. ✅ **FIXED — now packs BOTH `.docx` and `.pdf` per document** (each format fails independently), so it's a genuine "application package." **Verified:** end-to-end test builds a ZIP and confirms both entries present. Batch mode is Pro-gated, so ZIP is Pro-only. |

**Demo-ready:** Yes for a signed-in user. A cold stranger's export 401s.

---

## 6. Resume parsing from PDF/DOCX upload

Upload UI is wired on four pages (`GenerateForm.tsx:510`, `ScoreClient.tsx:153`, `FitClient.tsx:279`, `InterviewClient.tsx:836`), all feeding extracted text into live state that drives generation. Validation is solid: 5 MB cap, magic-byte anti-spoof, empty-text → 422.

✅ **FIXED — anonymous upload (was a silent 401):** the upload button rendered for logged-out users but `/api/parse-resume` required auth (401), so it failed with no fill. Chose to **allow anonymous parsing** (option a) rather than gate the button: it's cheap CPU (not an LLM call) and upload→first-generation is the try-before-signup moment. Logged-out requests are now **IP rate-limited** (`PARSE_RESUME_IP_LIMIT` = 10/hr via `lib/rate-limit.ts`) with the 5 MB cap retained; authenticated users are unlimited. The client handler was hardened to **always surface a visible error** (safe JSON parse, status-coded fallback, explicit empty-text message); the other three consumers already surface `!res.ok`. **Verified:** `tsc` clean.

| Path | Status | Evidence |
|---|---|---|
| **PDF upload** | ✅ **FIXED** (was 🔴) | Two rounds: (1) migrated off the broken `pdf-parse` v1 call, then (2) **replaced `pdf-parse` entirely with `unpdf`** after live-preview logs showed `pdf-parse@2` 500ing on Vercel with `ReferenceError: DOMMatrix is not defined` (its `pdfjs-dist/legacy` build needs a native canvas polyfill absent on serverless — local Node passed, serverless didn't). `unpdf` is a serverless-native pdfjs wrapper (no DOM/canvas): `extractText(await getDocumentProxy(new Uint8Array(buffer)), { mergePages: true })`. Response contract `{ text }` unchanged, so all four consumers work as-is (`GenerateForm` → `setCandidateInput`; Score/Fit/Interview → `setResumeText`). **Verified end-to-end on the deployed serverless preview:** anonymous PDF upload → HTTP 200 with extracted text (and DOCX via mammoth → 200); `tsc` clean. |
| DOCX upload | ✅ Working | `mammoth.extractRawText({ buffer })` (`route.ts:57-67`) — correct current API. |
| Save master resume | ✅ Working | `profile/resume` GET/PUT stores `profiles.resume_text`, auth-gated, 20k cap (`route.ts:47-58`) — no parsing involved. |

~~**This is the single highest-impact confirmed bug**~~ — ✅ **FIXED**: PDF extraction now uses `unpdf` (serverless-safe), verified returning 200 + text on the deployed preview. Works across Generate, Score, Fit, and Interview, for anonymous and authenticated users alike.

---

## 7. Chrome extension (per job board)

**One functional mechanism, no API integration.** `content.js` injects a floating button; on click it scrapes JD text via DOM selectors and `window.open`s `https://shortlist-amber.vercel.app/generate?jd=<encoded>` (`content.js:144-158`). **No API call, no auth, no session sharing, no `chrome.storage`.** The 12k-char slice (`content.js:156`) fits under the app's 20k `?jd=` cap (`GenerateForm.tsx:442-444`), so the hand-off path itself works. Whether the button appears is gated by `manifest.json` `matches`; extraction quality is gated by the per-board selector.

| Board | Status | Root cause / fix |
|---|---|---|
| Greenhouse | 🟡→✅ match fixed | Added `https://job-boards.greenhouse.io/*` to `matches` + `host_permissions`. Selectors unchanged. Live extraction still needs an unpacked-load check. |
| Lever | 🟡→✅ selector improved | Selector now prefers full-posting containers (`.posting-page` → `.section-wrapper.page-full-width` → `.content-wrapper`) before the old fragment fallbacks. Live check pending. |
| **Workday** | 🔴→✅ match fixed | Bare `myworkdayjobs.com/*` replaced with tenant-wildcard `https://*.myworkdayjobs.com/*` in `matches` + `host_permissions`, so the script now injects on `company.wdN.myworkdayjobs.com`. The correct `[data-automation-id='jobPostingDescription']` selector is unchanged. Live check pending. |
| Indeed | 🟡→✅ match fixed | Added `https://www.indeed.com/jobs*` so the modern `?vjk=` right-pane is covered (legacy `/viewjob*` retained). Selector `#jobDescriptionText` unchanged. |
| LinkedIn | 🟡→✅ match fixed | Added `https://www.linkedin.com/jobs/search/*`; content.js guard broadened to accept `/jobs/search/` so the `?currentJobId=` pane extracts. SPA re-injection retained. Classes remain fragile (rotation risk). |

**Cross-cutting extension defects — all ✅ FIXED:**
- ✅ **Popup button** — inline `<script>` (MV3 CSP-blocked) moved to external `chrome-extension/popup.js`, referenced via `<script src="popup.js">`.
- ✅ **`background.js` dead code** — file deleted; `background`/`service_worker` block removed from the manifest.
- ✅ **Unused permissions** — `scripting`, `activeTab`, `storage` removed; `permissions` is now `[]` (host permissions only). README permissions table updated to match.
- ✅ **Stray zip** — `shortlist-extension.zip` deleted from the repo root and added to `.gitignore`.

**Verification:** manifest re-parsed as valid JSON (`permissions: []`, no `background` key, 11 matches); no residual `chrome.scripting`/`chrome.storage`/`activeTab` references in code. **Match-pattern coverage is code-verified; live DOM extraction on each board requires loading the extension unpacked (manual — see list).**

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
- ~~**ZIP export** packs DOCX only~~ — ✅ **FIXED** (§5): ZIP now includes both DOCX and PDF per doc. (Still Pro-only, which is by design.)
- **Chrome extension on Greenhouse / Lever / Indeed / LinkedIn** — partial: may silently fail to inject or grab only a fragment. A live demo can no-op unpredictably.
- **`/privacy`** — off-theme and shows the wrong contact address; looks half-finished.
- ~~**"Quality-gated output"** — validator fails open~~ — ✅ **FIXED** (§3/§5): validator now fails **closed** to a neutral "Not graded" state; no fabricated PASS.
- **`/admin/quality`** — real and useful, but admin-only; not a public demo.

### 🔴 Cut or rebuild (broken, or claimed-but-absent)
- ~~**PDF resume upload** broken on every PDF~~ — ✅ **FIXED** (§6): now uses `unpdf` (serverless-safe pdfjs) after `pdf-parse` proved DOMMatrix-incompatible with Vercel's runtime; verified returning 200 + text on the deployed preview. Safe to claim.
- ~~**Chrome extension — Workday** never injects~~ — ✅ **FIXED** (§7): `*.myworkdayjobs.com` added to matches + host_permissions.
- ~~**Chrome extension — popup button + `background.js`**~~ — ✅ **FIXED** (§7): popup handler moved to external `popup.js`; dead `background.js` deleted.
- ~~**Chrome extension — unused permissions**~~ — ✅ **FIXED** (§7): `scripting`/`activeTab`/`storage` removed; `permissions: []`.
- ~~**LinkedIn OAuth** documented but absent~~ — ✅ **RESOLVED** (§2): decision reversed — LinkedIn OIDC deliberately dropped; button removed and `CLAUDE.md` claim removed. Auth surface is Google + GitHub + magic link. Code and docs now agree.
- ~~**`handle_new_user()` signup trigger**~~ — ✅ **FIXED + APPLIED** (§2): `schema.sql` hardened + `migration_009.sql` **run against production** by the owner.
- ~~**`/api/interview`** unthrottled~~ — ✅ **FIXED** (§3): IP rate-limited (10/hr/IP); anonymous `/generate` also IP-limited (5/hr/IP). Shared `lib/rate-limit.ts` (Upstash when configured, in-memory fallback).
- ~~**Anonymous resume upload silently 401'd**~~ (found in live testing) — ✅ **FIXED** (§6): the upload button showed for logged-out users but `/api/parse-resume` required auth and failed with no fill. Now **anonymous upload is allowed** (option a) with a 10/hr IP limit + 5 MB cap; the client always surfaces a visible error. Uncovered and fixed a follow-on serverless PDF crash (`pdf-parse` → `unpdf`). Verified anon DOCX **and** PDF → 200 on the deployed preview.
- ~~**Stripe webhook module-scope Supabase client**~~ — ✅ **FIXED** (§4): now lazy via `getSupabaseAdmin()` inside `POST`; `next build` succeeds with the Supabase env vars unset.

---

### Résumé-claim guidance (blunt)
Safe to claim without qualification: **an authenticated, streaming, self-critiquing LLM generation pipeline (generate → validate → retry) on Claude Sonnet/Haiku with SSE**, **Stripe subscription billing with webhook-driven entitlement**, **Supabase auth + RLS**, and **server-side DOCX/PDF/ZIP export**. After the remediation pass, **PDF resume ingestion** now works, the structured LLM routes parse robustly (retry-once, fail-closed validator), anonymous traffic is rate-limited, and the **Chrome extension** match patterns / popup / permissions are fixed. The signup-trigger migration has now been **applied to production**, and LinkedIn sign-in was intentionally dropped (auth surface: Google + GitHub + magic link). What remains is operational verification, not code — load the extension unpacked and a Stripe smoke test (see below). The breadth of features is real; the remaining risk is deployment config, not code.

---

## Needs manual verification

These changes are complete in code and verified as far as this environment allows, but their real-world effect depends on access this environment doesn't have. **Not marked done.**

> ✅ **Already applied since the audit:** `migration_009.sql` (signup trigger) was **run against production** by the owner — no longer pending. LinkedIn OIDC was **dropped** (not a manual step). Preview + production `ANTHROPIC_API_KEY` corrected Vercel-side.

1. **Load the Chrome extension unpacked and test each board** (§7). Match patterns are code-verified; live DOM extraction is not. Load `chrome-extension/` via `chrome://extensions` → Developer mode → Load unpacked, then confirm the button injects and captures the JD on: a **Workday tenant** (`*.wdN.myworkdayjobs.com`), a **`job-boards.greenhouse.io`** posting, the **Indeed `?vjk=` right pane**, the **LinkedIn `?currentJobId=` search pane**, and a **Lever** posting (full description, not just requirements). Also confirm the popup **"Open Shortlist"** button works (external `popup.js` under MV3 CSP).
2. **Rate limiting with Upstash configured** (§3). Verified the in-memory fallback (caps + key isolation) via unit test. With `UPSTASH_REDIS_REST_URL`/`_TOKEN` set, confirm the Redis path limits across instances, and that Vercel's `x-forwarded-for` yields a usable client IP (not a shared/`unknown` bucket).
3. **Stripe redirect smoke test on the live domain** (§4). The `x-forwarded-host` validation + lazy webhook client are code-verified; do one real checkout on `shortlist-amber.vercel.app` and confirm success/cancel/portal redirects land correctly and the plan flips to Pro.
4. *(optional, deterministic in code)* **Visual checks**: the logged-out "Sign in to export" state (§5), the neutral "Not graded" validator badge (§5), the anonymous resume-upload → textarea fill (§6), and the dark `/privacy` page (P2) all render from deterministic conditionals verified by `tsc`; a quick look is nice-to-have, not required.
