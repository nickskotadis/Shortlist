# Shortlist — Project Context for Claude

## What this is
AI resume + cover letter generator with job description tailoring. Next.js 16, React 19, Supabase, Anthropic SDK, Stripe, Tailwind v4. Deployed to Vercel at https://shortlist-amber.vercel.app.

## Architecture prompt (reference for all decisions)

You are a principal engineer + AI product architect working on Shortlist. Your goal is to minimize mistakes, control cost, and ensure quality + safety. When making decisions, reason against this framework:

**Assumptions:**
- Web app (responsive)
- Auth + user profiles
- Resume data ingest (manual + PDF upload optional)
- Job description input
- LLM API calls for generation + critique + rewriting
- Export to PDF/DOCX
- Analytics + A/B testing later

**Decision framework covers:**
1. Non-functional requirements — latency targets, reliability, PII/compliance, threat model (prompt injection, data exfiltration, malicious job postings)
2. Data model — what to store and what NOT to store across: User, Profile, JobPosting, GeneratedDoc, PromptRun, Feedback, Versioning
3. System architecture — frontend, backend services, LLM orchestration, queue/job system, storage, observability
4. Stack — justify every choice, pick one option decisively
5. LLM orchestration — prompt versioning, personalization pipeline, structured IR, multi-step generation, quality checks
6. Cost & performance — token budgets, caching, model routing, abuse prevention
7. Security & privacy — PII handling, encryption, retention policy, delete account behavior
8. Testing — unit/integration, prompt regression (golden outputs), red-team cases
9. Milestone plan — Week 1 foundation, Week 2 LLM pipeline, Week 3 export, Week 4 payments, Week 5 analytics
10. Gotchas — top 15 LLM production mistakes

Be decisive. If there are options, pick one and justify it.

## Current state (updated as work progresses)

### "Paper & Ink" redesign — DONE
- Wholesale reskin from the old deep-navy/indigo dark theme to a **single light editorial theme** (warm paper `#FAF9F6`, ink `#211E1A`, one forest-green accent `#2F4A3C`). No dark mode, no toggle. Print/editorial typography, structure over decoration. **Zero functional changes** — presentation only.
- Display serif **Fraunces** added via `next/font` (`--font-fraunces`) for headings/key moments; Geist Sans (body) + Geist Mono (output) unchanged. See **Design system** below for tokens, type scale, and recipes.
- Removed `next-themes`/`ThemeProvider` + the UserMenu mode toggle; deleted the aurora gradient, grain overlay, `.btn-shimmer`, `.text-gradient`, `.cursor-blink`. All indigo → accent; status colors redefined muted-editorial for light bg. Chrome extension (`content.js` button + `popup.html`) got a matching pass.

### Week 1 — DONE
- Supabase auth (magic link) wired
- `proxy.ts` refreshes sessions on every request; protects `/dashboard`
- `/api/generate` saves every generation to DB (authenticated users only)
- JD parsing moved to Haiku (was Sonnet — cost fix)
- Input length validation on generate route
- Prompt injection defense in system prompt
- `PROMPT_VERSIONS` constant in `lib/constants.ts` — stored on every generations row
- Token counts (`input_tokens`, `output_tokens`) tracked via `finalMessage()`

### Week 2 — DONE
- Hallucination + skill inflation detection in validator (validator-v2); issues surfaced in OutputPanel as amber warning card; do NOT drive retries — retrying can't fix fabricated metrics when input is vague
- JD analysis cache (Upstash KV, SHA-256 hash key, 1h TTL); null-safe — works without env vars; requires UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
- Dashboard page (`/dashboard`) — last 50 generations, expandable cards with score bars + copy
- Prompt version registry was completed in Week 1

### Week 3 — DONE
- DOCX export (`docx` pkg) — `/api/export` POST, server-side generation, binary stream to client
- PDF export (`@react-pdf/renderer`) — same route, `format` param selects DOCX vs PDF; `serverExternalPackages` required in `next.config.ts`
- No Supabase Storage — direct download, no signed URLs needed
- Feedback rating (thumbs up/down) — `generations.feedback_positive boolean` column; `/api/generations/[id]/feedback` PATCH; optimistic UI in dashboard cards; UPDATE RLS policy required (`migration_002.sql`)

### Post-Week 3 cleanup — DONE
- `generation_id` surfaced through SSE `done` event → `GenerateResult` → `OutputPanel`; DB insert moved before `done` send so ID is available immediately
- Thumbs up/down feedback added to `OutputPanel` (fresh generations) — only visible when authenticated (generation_id present); previously dashboard-only
- Export error messages — both `OutputPanel` and dashboard cards now show inline error instead of silent failure
- `migration_003.sql` — drops unused `feedback_rating smallint` column (was in migration_001, never used); adds `on_generation_created` trigger to increment `profiles.generation_count` on every insert (required for Week 4 rate limiting); backfill: `UPDATE profiles SET generation_count = (SELECT COUNT(*) FROM generations WHERE user_id = profiles.id)`

### Week 4 — DONE
- Stripe billing: Free (2 generations/month) and Pro (unlimited, $7/mo or $63/yr)
- `lib/stripe.ts` — lazy `getStripe()` singleton; deferred init so builds don't fail when `STRIPE_SECRET_KEY` is unset
- `/api/stripe/checkout` — POST, accepts `{ billingPeriod: "monthly" | "annual" }`, server resolves price ID from env vars (never exposed to client), returns `{ url }`
- `/api/stripe/portal` — POST, requires `profiles.stripe_customer_id`, returns `{ url }`
- `/api/stripe/webhook` — POST, uses `req.text()` for raw body, verifies Stripe signature; handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`; uses service-role Supabase client (`createClient` from `@supabase/supabase-js` directly) to bypass RLS
- Rate limit check in `/api/generate` — before stream starts; returns 429 `{ error: "monthly_limit_reached" }` for free users at limit; counts this month's generations via DB query (no cron)
- `useGenerate` hook — new `limitReached: boolean` state; 429 + `monthly_limit_reached` sets it; reset on each new generate call
- Generate page split: `app/generate/page.tsx` is now an async server wrapper that fetches `{ plan, usedThisMonth }` and passes `initialUsage: PlanUsage | null` to `app/generate/GenerateForm.tsx` (client component)
- Usage meter in generate page section 5: free users see progress bar + "Upgrade to Pro →" link; Pro users see "Pro · Unlimited" pill; unauthenticated users see nothing
- When `limitReached` is set: generate button replaced with amber upgrade CTA card
- Dashboard — fetches `profiles.plan` in parallel with generations; shows Free/Pro badge in nav; free users see usage progress bar in header area
- Pricing page (`/pricing`) — two-column Free vs Pro cards, monthly/annual billing toggle, correct prices displayed via `fmt()` helper
- `FREE_MONTHLY_LIMIT = 2` added to `lib/constants.ts`
- Vercel deployment: all env vars added with `printf` (not `echo`) to avoid trailing newline — critical for `STRIPE_WEBHOOK_SECRET` (trailing newline causes signature verification to fail on every webhook delivery)
- Stripe webhook registered at `https://shortlist-amber.vercel.app/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

### Week 5 — DONE
- **PostHog event instrumentation** — `posthog-js/react` on client; `usePostHog()` hook in `GenerateForm`, `OutputPanel`, `app/score/ScoreClient.tsx`, `app/pricing/page.tsx`; events: `generation_started`, `generation_completed`, `document_type_selected`, `tone_selected`, `export_clicked`, `upgrade_clicked`, `score_page_viewed`; metadata only, never content fields
- **Sentry** — `@sentry/nextjs` v10.42; `sentry.client.config.ts` (renamed to `instrumentation-client.ts`) + `sentry.server.config.ts` + `sentry.edge.config.ts`; loaded via `instrumentation.ts` (Next.js 15+ pattern); `app/global-error.tsx` error boundary; org `sko-ft`, project `javascript-nextjs`; DSN hardcoded (not secret); `tunnelRoute: "/monitoring"`, `widenClientFileUpload: true`; source maps upload on every build via `SENTRY_AUTH_TOKEN`; `sendDefaultPii: true`, `tracesSampleRate: 1` (consider reducing in production)
- **Admin quality dashboard** — `app/admin/quality/page.tsx`; protected by `ADMIN_EMAILS` env var (comma-separated); aggregates `generations` by `prompt_version` + `ab_variant`; shows count, avg score, pass rate, 👍 rate
- **A/B test flag** — `PROMPT_AB_VARIANT: "A" | "B"` in `lib/constants.ts`; read from `process.env.PROMPT_AB_VARIANT`; stored as `ab_variant` on every `generations` row; `migration_005.sql`
- **PostHog provider** — `components/PostHogProvider.tsx` wraps `app/layout.tsx`; env vars `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`

### Differentiating features — DONE
- **Quality score ring** — SVG ring in `OutputPanel` showing generation quality (1–10); colour-coded: emerald ≥8, indigo ≥6, amber <6; amber nudge shown when overall <7
- **Tailoring recommendations** — 4th Haiku call (fire-and-forget) after `done` SSE event; `buildTailoringRecommendationsPrompt()` in `lib/prompts.ts`; `tailoring_suggestions` SSE event type; collapsible `TailoringPanel` in `OutputPanel`; only fires when `candidate_input.length > 200` and JD has `key_terminology`
- **Job Application Tracker** — `app/applications/page.tsx` (server) + `app/applications/ApplicationsClient.tsx` (client); `app/api/applications/route.ts` (GET/POST/PATCH); statuses: `applied | interview | offer | rejected | withdrawn`; links to generated docs via `job_application_id` FK; `migration_006.sql` adds `status`, `url`, `notes` to `job_applications`
- **Follow-up email generator** — `app/api/follow-up/route.ts` POST; Haiku model; available from Applications tracker on "applied" status entries; generates 3–4 sentence email with subject line
- **Batch mode generation** — `hooks/useBatchGenerate.ts`; sequential bullets → cover_letter → linkedin_about; JD analysis cached after first doc; `BatchOutputPanel` in `GenerateForm` with tab UI + streaming indicators; ZIP export via jszip; **Pro-gated** — free users see a locked `<Link href="/pricing">` wrapper with a "Pro" badge instead of the toggle switch; `batchMode` state can never become `true` for free users
- **ZIP export** — `app/api/export/route.ts` supports `format: "zip"` with `batch` array; uses `jszip` with `arraybuffer` type (not `nodebuffer` — TypeScript compat); `Content-Length` uses `zipBytes.byteLength`
- **Chrome extension** — `chrome-extension/` directory; Manifest V3; `content.js` extracts JD from Greenhouse, Lever, Workday, Indeed, LinkedIn; floating indigo button opens `/generate?jd=<encoded>`; `background.js` + `popup.html`; icons generated by `chrome-extension/generate-icons.js` (zero-dep Node.js PNG generator using zlib); `manifest.json` has `homepage_url` + `minimum_chrome_version: 102`; submission package at `shortlist-extension.zip` (project root)

### Prompt quality improvements — DONE (prompt versions bumped)
- **bullets-v2** — structural variety required (no all-same [Verb+what+result] pattern); "50 other resumes" quality bar test; scope/timeframe/outcome-first opening examples
- **summary-v2** — first sentence formula explicitly banned ("Experienced X with N years..."); must lead with most compelling specific thing
- **cover-letter-v2** — explicit first-person instruction throughout; Paragraph 1 avoids opening with "I" but rest uses I/my/me; "Why This Company" paragraph calls out generic praise as worthless; closer must be direct, not "I hope to hear from you"
- **System prompt** — upgraded from "You are an expert career writer" to full elite career strategist persona emphasising human-sounding, specific output
- **bullets-v3 / summary-v3 / cover-letter-v3 / linkedin-about-v2 / linkedin-headline-v2** — explicit rule banning em dashes (—) as clause connectors across all 5 generator prompts; em dashes are the single strongest AI writing signal; rule instructs rewriting as comma, period, or restructured sentence instead

### Post-Week 4 features — DONE
- **Save master resume** — `profiles.resume_text text` column; GET/PUT `/api/profile/resume`; generate page fetches it server-side and pre-fills the resume textarea; "Save as default resume" button persists on blur; "Saved ✓" badge when populated
- **PDF/DOCX upload** — `/api/parse-resume` POST accepts multipart `file` field; `unpdf` (serverless-safe pdfjs) for PDFs, `mammoth` for DOCX; both in `serverExternalPackages`; shared by `/generate`, `/score`, `/fit`, `/interview`; anonymous upload allowed with an IP rate limit (10/hr, `lib/rate-limit.ts`)
- **Named generations** — `generations.label text` column; PATCH `/api/generations/[id]/label`; inline label input in `OutputPanel` (saves on blur/Enter); label shown as card title in dashboard, editable inline in expanded card view
- **Keyword gap analysis** — `done` SSE event now includes `keywords: string[]` (from `jdAnalysis.key_terminology`); `OutputPanel` shows matched keywords (green ✓) vs missing (grey ✗) using case-insensitive substring match on the output text
- **LinkedIn doc types** — `DocumentType` extended to include `"linkedin_about" | "linkedin_headline"`; both are JD-optional (`noJd: true` in DOC_TYPES); new prompt builders `buildLinkedInAboutPrompt()` and `buildLinkedInHeadlinePrompt()` in `lib/prompts.ts`; generate route handles both in the switch
- **Tone selector** — `ToneType = "professional" | "conversational" | "bold"` in `lib/types.ts`; `TONES` config array in `lib/constants.ts`; `buildToneInstruction(tone)` injects tone override block into all generator prompts; `tone` stored on `generations` row; UI in generate form section (3 toggle buttons)
- **Resume health score** — `/score`; `/api/score` POST uses Haiku (`MODELS.parser`) + `buildHealthScorePrompt()`; scores 5 dimensions (clarity, impact, ats_friendliness, action_verbs, quantification); SVG score ring + dimension cards + 3–5 recommendations; CTA links to `/generate`; PDF/DOCX upload supported; **free limit: 1 score** (Pro: unlimited); `profiles.score_count` tracks usage; API returns 429 `score_limit_reached` for free users at limit; `score/page.tsx` fetches `plan, score_count` server-side and passes to `ScoreClient` so gate renders immediately; increment is fire-and-forget via `void supabase.from("profiles").update(...)` after successful score; `migration_007.sql`
- **Session expiry UX** — `useGenerate` now sets `sessionExpired: boolean` on 401 response; `GenerateForm` shows "Session expired — log in again" amber card instead of silent failure
- **Chrome extension JD import** — `GenerateForm` reads `?jd=` URL param on mount via `useEffect` and pre-fills `jdText`; no backend changes needed
- **Dashboard empty state** — improved with icon, descriptive copy, and "Score my resume" secondary CTA
- **`migration_004.sql`** — `profiles.resume_text`, `generations.label`, `generations.tone`; applied to production
- **Interview prep** — free page at `/interview`; POST `/api/interview` uses Haiku (`MODELS.parser`) + `buildInterviewPrepPrompt()`; generates 6–8 tailored questions covering all 4 categories (behavioral, technical, situational, culture); each question includes `why_asked` + STAR-format `framework` tailored to candidate's resume; no auth required, no generation count; `max_tokens: 4096` (STAR frameworks verbose); per-card copy button; `interview_prep_page_viewed` + `interview_prep_generated` PostHog events; Interview link added to `Nav`, `NavMobileMenu`, and `GenerateForm` inline nav; `activePage` union in `Nav` extended to include `"interview"`
- **AI Answer Coach** — Pro-only; POST `/api/interview/evaluate`; requires auth + `profiles.plan === "pro"` (401 / 403 otherwise); validates `user_answer` 10–3,000 chars; calls Haiku (`MODELS.parser`) + `buildAnswerCoachPrompt()`; returns `AnswerCoachResult` (`score 1–10`, `feedback`, `what_worked[]`, `what_to_improve[]`); score ring reuses same SVG ring pattern as OutputPanel (emerald ≥8, indigo ≥6, amber <6); per-card state: `practiceOpen`, `answerText`, `evalResult`, `evalError`; free/unauthenticated users see a static lock-icon pill linking to `/pricing`; PostHog event `interview_answer_evaluated` with `{ score }`; `interview/page.tsx` now selects `plan, resume_text` from profiles and passes `plan` prop to `InterviewClient`; prompt version `answer-coach-v1` in `PROMPT_VERSIONS`; `AnswerCoachResult` type in `lib/types.ts`
- **Mock Interview Simulator** — Pro-only conversational mode added to `InterviewClient` via mode toggle ("Question Bank" / "Mock Interview"); POST `/api/interview/mock` with `{ action: "turn" | "debrief", conversation: MockInterviewMessage[], resume_text, jd_text?, category_focus? }`; "turn" calls Sonnet to generate the next interviewer question/follow-up; "debrief" calls Sonnet for full scored debrief; multi-turn Anthropic messages array: interviewer → assistant role, candidate → user role, conversation anchored by fixed INIT_USER_MSG at position 0; "End session + get debrief" button unlocks after 3 candidate answers; debrief: `MockInterviewDebrief` (overall_score 1–10, summary, strengths[], areas_to_improve[], dimension_scores {structure, specificity, confidence, relevance}, next_steps[]); category_focus selector: all/behavioral/technical/situational; `maxDuration = 60`; PostHog events: `mock_interview_started`, `mock_interview_completed`; `buildMockInterviewSystemPrompt()` + `buildMockInterviewDebriefPrompt()` in `lib/prompts.ts`
- **Salary Negotiation Coach** — Pro-only; `app/negotiate/page.tsx` (server wrapper, fetches `plan + resume_text`) + `app/negotiate/NegotiateClient.tsx` (client); POST `/api/negotiate`; input: company, role, current_offer (number), target_offer (number), currency, bonus, equity, competing_offer, notes, optional resume_text; output: `NegotiationResult` (strategy, counter_email, phone_script, pushback_responses[]); uses Sonnet for full quality; `maxDuration = 60`; 4-tab result UI (Strategy / Counter Email / Phone Script / Handle Objections) with per-tab copy button and delta summary (+N, X%); sanitizes all string fields to 500 chars; `buildNegotiationPrompt()` in `lib/prompts.ts`; free/unauthenticated users see upgrade gate immediately (server-side)
- **Job Fit Scorer** — free limit: 1 check (Pro: unlimited); `app/fit/page.tsx` (server wrapper, fetches `plan + fit_count + resume_text`) + `app/fit/FitClient.tsx` (client); POST `/api/fit`; input: resume_text + jd_text (both required); output: `FitScoreResult` (overall 0–100, recommendation enum, summary, dimensions {skills_match, experience_level, must_haves, nice_to_haves}, top_gaps[], top_strengths[]); uses Haiku; `maxDuration = 30`; 429 `fit_limit_reached` for free users at limit; `profiles.fit_count` tracks usage (fire-and-forget increment); FitRing uses 0–100 scale (unlike other rings which are 1–10); dimension bars with expandable gaps list; `FREE_FIT_LIMIT = 1` in `lib/constants.ts`; `buildFitScorePrompt()` in `lib/prompts.ts`; `migration_008.sql` adds `fit_count + negotiation_count` to profiles
- **Nav updated** — `activePage` union extended to include `"fit" | "negotiate"`; NAV_LINKS in both `Nav.tsx` and `NavMobileMenu.tsx` now include Fit (`/fit`) and Negotiate (`/negotiate`)

### Auth UX — DONE
- **UserMenu** — `components/UserMenu.tsx`; client component; indigo initials avatar (2-char derived from email local part); click opens dropdown with "Signed in as [email]" + "Sign out" link; outside-click dismiss via `useEffect`
- **Nav** — `components/Nav.tsx`; async server component; fetches user + plan from Supabase; props: `activePage`, `actions: React.ReactNode`; always uses `max-w-7xl` inner container (no `maxWidth` prop — was removed to prevent layout shift between pages); shows nav links (Dashboard/Applications/Generate/Fit/Score/Interview/Negotiate) only when authed; right side: `actions` + plan badge + `<UserMenu>` when authed, "Sign in" link when not; `activePage` type: `"dashboard" | "applications" | "generate" | "score" | "interview" | "fit" | "negotiate"`
- **Logout route** — `app/auth/logout/route.ts`; GET handler; calls `supabase.auth.signOut()` then redirects to `/`
- **Social sign-in** — Google + GitHub OAuth buttons in `app/auth/login/page.tsx`; each calls `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin + '/auth/callback' } })`; existing `/auth/callback/route.ts` handles code exchange unchanged; providers must be enabled in Supabase Dashboard → Authentication → Providers. (LinkedIn OIDC was evaluated and deliberately not enabled — the auth surface is Google + GitHub + magic link.)
- **Score page restructured** — `app/score/page.tsx` is now an async server wrapper rendering `<Nav activePage="score" />`; interactive content extracted to `app/score/ScoreClient.tsx` (`"use client"`)

### UI Redesign — DONE
- **Full dark theme** — all pages and components converted from light (`slate-50`/`bg-white`) to deep navy dark theme; see Design System below for the complete palette
- **Pages updated** — `app/page.tsx`, `app/dashboard/page.tsx`, `app/dashboard/GenerationsClient.tsx`, `app/generate/GenerateForm.tsx`, `app/applications/page.tsx`, `app/applications/ApplicationsClient.tsx`, `app/score/page.tsx`, `app/score/ScoreClient.tsx`, `app/pricing/page.tsx`, `app/auth/login/page.tsx`, `app/admin/quality/page.tsx`, `app/admin/quality/QualityClient.tsx`
- **Components updated** — `components/Nav.tsx`, `components/UserMenu.tsx`, `components/OutputPanel.tsx`
- **globals.css** — added indigo aurora radial gradient on `body`, SVG grain texture via `body::before` at 2.8% opacity; both give depth and atmosphere to the dark background
- **Nav pill buttons** — nav links converted from plain text to `px-3 py-1.5 rounded-lg` pill buttons; active page has `bg-[#13182C] border border-[#232548]` filled state; inactive has hover fill only; `h-14` fixed height on all navs
- **Nav alignment fix** — `px-6` moved from `<nav>` element to the inner `<div>` so `mx-auto` centers against the full viewport; `maxWidth` prop removed entirely — all navs use `max-w-7xl` so buttons never shift between pages
- **Generate page inline nav** — mirrors the shared Nav styles exactly (client component can't import async server Nav)

## Key files
- `lib/constants.ts` — model names, prompt versions, banned phrases, thresholds, `FREE_MONTHLY_LIMIT`, `TONES`, `PROMPT_AB_VARIANT`
- `lib/prompts.ts` — all prompt builders; bump `PROMPT_VERSIONS` on every change; includes `buildToneInstruction()`, `buildLinkedInAboutPrompt()`, `buildLinkedInHeadlinePrompt()`, `buildHealthScorePrompt()`, `buildTailoringRecommendationsPrompt()`, `buildInterviewPrepPrompt()`, `buildAnswerCoachPrompt()`, `buildMockInterviewSystemPrompt()`, `buildMockInterviewDebriefPrompt()`, `buildNegotiationPrompt()`, `buildFitScorePrompt()`
- `lib/types.ts` — shared types including SSE event shapes; `ToneType`, `HealthScoreResult`, `InterviewQuestion`, `InterviewPrepResult`, `AnswerCoachResult`, `MockInterviewMessage`, `MockInterviewDebrief`, `NegotiationResult`, `FitDimension`, `FitScoreResult`, updated `DocumentType`; `tailoring_suggestions` in `SseEvent` union
- `lib/stripe.ts` — lazy `getStripe()` singleton (server only — never import from client)
- `app/api/generate/route.ts` — main LLM pipeline (SSE streaming); rate limit check; 5 doc types; `ab_variant` stored on DB insert; Stage 5 tailoring Haiku call (fire-and-forget); `maxDuration = 60`
- `app/api/export/route.ts` — DOCX/PDF/ZIP export; ZIP uses jszip `arraybuffer` type
- `app/api/applications/route.ts` — GET/POST/PATCH job applications (RLS-enforced)
- `app/api/follow-up/route.ts` — POST follow-up email generation via Haiku; `maxDuration = 30`
- `app/api/profile/resume/route.ts` — GET/PUT saved resume text for authenticated user
- `app/api/generations/[id]/label/route.ts` — PATCH label on a generation (RLS-enforced)
- `app/api/generations/[id]/feedback/route.ts` — PATCH feedback_positive (thumbs up/down); RLS-enforced
- `app/api/parse-resume/route.ts` — multipart POST; unpdf (PDF) + mammoth (DOCX); max 5 MB; anonymous allowed, IP rate-limited (10/hr)
- `app/api/score/route.ts` — POST resume text, returns `HealthScoreResult` via Haiku; `maxDuration = 30`; checks `plan + score_count` for free limit (429 `score_limit_reached`); increments `score_count` fire-and-forget on success
- `app/api/interview/route.ts` — POST resume + optional JD, returns `InterviewPrepResult` via Haiku; no auth required; `max_tokens: 4096`; `maxDuration = 60`
- `app/api/interview/evaluate/route.ts` — POST; requires auth + Pro plan (401/403); validates answer 10–3,000 chars; returns `AnswerCoachResult` via Haiku; `max_tokens: 1024`; `maxDuration = 30`
- `app/api/interview/mock/route.ts` — POST; requires auth + Pro plan (401/403); `action: "turn" | "debrief"`; turn uses Sonnet multi-turn messages array; debrief requires ≥4 conversation messages; `maxDuration = 60`
- `app/api/fit/route.ts` — POST; auth optional; checks `profiles.fit_count` for free limit (429 `fit_limit_reached`); Haiku + `buildFitScorePrompt()`; fire-and-forget fit_count increment; `maxDuration = 30`
- `app/api/negotiate/route.ts` — POST; requires auth + Pro plan (401/403); sanitizes all string fields (500 char max); Sonnet + `buildNegotiationPrompt()`; `maxDuration = 60`
- `app/interview/page.tsx` — async server wrapper; fetches `profiles.plan, profiles.resume_text` if logged in; passes both to `<InterviewClient />`
- `app/interview/InterviewClient.tsx` — `"use client"`; mode toggle (Question Bank / Mock Interview); Question Bank: per-question cards with category badge, why_asked, STAR framework, copy, Pro answer practice; Mock Interview: category focus selector, chat UI with interviewer/candidate bubbles, typing indicator, "End session" → debrief with dimension scores + next steps; both modes share JD + resume inputs
- `app/fit/page.tsx` — async server wrapper; fetches `profiles.plan, profiles.fit_count, profiles.resume_text`; passes to `<FitClient />`
- `app/fit/FitClient.tsx` — `"use client"`; JD textarea + resume textarea + PDF/DOCX upload; free gate when `fit_count >= FREE_FIT_LIMIT && plan !== "pro"`; FitRing (0–100 scale), dimension bars with expandable gap lists, top strengths/gaps cards, CTA to /generate
- `app/negotiate/page.tsx` — async server wrapper; fetches `profiles.plan, profiles.resume_text`; non-pro/non-authed users see upgrade gate immediately
- `app/negotiate/NegotiateClient.tsx` — `"use client"`; form with company/role/offer/target/currency/bonus/equity/competing_offer/notes/resume; 4-tab result (Strategy/Counter Email/Phone Script/Handle Objections) with per-tab copy and delta summary badge
- `app/api/stripe/checkout/route.ts` — creates Stripe Checkout Session
- `app/api/stripe/portal/route.ts` — creates Stripe Customer Portal session
- `app/api/stripe/webhook/route.ts` — handles Stripe webhook events, service-role Supabase writes
- `app/generate/page.tsx` — async server wrapper; fetches plan + monthly usage + `profiles.resume_text` + `user.email`; passes all as props to `GenerateForm`
- `app/generate/GenerateForm.tsx` — `"use client"` form; accepts `userEmail?: string | null`; renders `<UserMenu>` in nav when authed; batch mode toggle (Pro only — free users see locked `/pricing` link with "Pro" badge); `BatchOutputPanel`; `generatingRef` prevents double-fire on rapid clicks; PostHog events
- `app/applications/page.tsx` — server component; fetches applications + generation counts; uses `<Nav activePage="applications" />`
- `app/applications/ApplicationsClient.tsx` — client; status updates, follow-up email panel, add form
- `app/admin/quality/page.tsx` — protected by `ADMIN_EMAILS`; aggregates generations by prompt_version + ab_variant
- `app/score/page.tsx` — async server wrapper; fetches `profiles.plan, profiles.score_count` if logged in; passes both to `<ScoreClient />`
- `app/score/ScoreClient.tsx` — `"use client"`; accepts `plan`, `scoreCount` props; renders upgrade gate immediately when `plan !== "pro" && scoreCount >= 1`; header badge reflects plan; `score_page_viewed` PostHog event
- `app/auth/logout/route.ts` — GET; signs out via Supabase, redirects to `/`
- `app/pricing/page.tsx` — pricing page; `upgrade_clicked` PostHog event
- `components/Nav.tsx` — async server component; shared nav with user auth + plan fetch; accepts `activePage`, `actions` props; always `max-w-7xl` inner container; pill-button nav links
- `components/UserMenu.tsx` — `"use client"`; indigo initials avatar + dropdown (email display + sign out)
- `hooks/useGenerate.ts` — SSE consumer; `tailoringSuggestions: string[]` state
- `hooks/useBatchGenerate.ts` — sequential batch SSE consumer; `BatchState` per doc type
- `components/OutputPanel.tsx` — `QualityRing` SVG, `TailoringPanel` collapsible, keyword gap, label input
- `components/PostHogProvider.tsx` — initialises posthog on mount; wraps `app/layout.tsx`
- `instrumentation.ts` — Next.js instrumentation hook; loads `sentry.server.config.ts` (nodejs) or `sentry.edge.config.ts` (edge) at runtime
- `instrumentation-client.ts` — client-side Sentry init with Session Replay; `onRouterTransitionStart` export
- `sentry.server.config.ts` / `sentry.edge.config.ts` — server + edge Sentry init
- `app/global-error.tsx` — Sentry error boundary for unhandled app-level errors
- `supabase/schema.sql` — base schema
- `supabase/verify.ts` — ad-hoc schema verification utility (Supabase CLI)
- `supabase/migration_001.sql` — plan/billing + generation metadata columns
- `supabase/migration_002.sql` — feedback_positive column + UPDATE RLS policy
- `supabase/migration_003.sql` — drop feedback_rating; generation_count trigger
- `supabase/migration_004.sql` — resume_text, label, tone columns
- `supabase/migration_005.sql` — ab_variant column on generations
- `supabase/migration_006.sql` — status, url, notes columns on job_applications
- `supabase/migration_007.sql` — score_count column on profiles (resume health score usage tracking)
- `supabase/migration_008.sql` — fit_count + negotiation_count columns on profiles
- `lib/export.ts` — server-only DOCX + PDF generators; handles all 5 doc types
- `chrome-extension/` — Manifest V3 extension; content.js, background.js, popup.html, icons/
- `chrome-extension/generate-icons.js` — run with `node chrome-extension/generate-icons.js` to regenerate PNG icons; zero dependencies (zlib only)
- `app/privacy/page.tsx` — static privacy policy page at `/privacy`; required by Chrome Web Store
- `proxy.ts` — Next.js 16 session middleware (Next.js 16 uses `proxy.ts` / `proxy()` export, not `middleware.ts`)

## Design system

**Theme:** "Paper & ink" — a single **light** editorial theme. No dark mode, no toggle. The design language is print/editorial typography: warm paper, near-black ink, one restrained accent, hairline rules, whitespace and type hierarchy over borders/cards.

**All themable values are CSS custom properties in `app/globals.css` (`:root`).** Components reference them via `var(--color-*)` in Tailwind arbitrary values — **never raw hex in components.** A future retheme is a one-file edit. Surfaces/text/borders across every page already flow through these tokens.

### Tokens (semantic CSS vars — the source of truth)
| Token | Value | Role |
|---|---|---|
| `--color-page` | `#FAF9F6` | warm paper background (every page wrapper: `bg-[var(--color-page)]`) |
| `--color-surface` | `#FFFFFF` | document/card paper |
| `--color-inset` | `#F3F1EA` | recessed areas, pre blocks, marginalia |
| `--color-elevated` | `#F6F4EE` | inputs, subtle raised |
| `--color-disabled` | `#EEEBE3` | disabled button bg |
| `--color-ink` | `#211E1A` | primary text (warm near-black) |
| `--color-ink-secondary` | `#57524A` | body, meta |
| `--color-ink-tertiary` | `#726C60` | hints, timestamps, editorial labels |
| `--color-ink-placeholder` | `#9A9488` | input placeholders |
| `--color-rule` | `#E5E1D8` | hairline borders/dividers |
| `--color-rule-strong` | `#CFC9BB` | hover/emphasis borders |
| `--color-separator` | `#BDB6A6` | `·` separators |
| `--color-accent` | `#2F4A3C` | **forest green** — primary actions, active/selected, focus |
| `--color-accent-hover` | `#24382D` | accent hover |
| `--color-accent-weak` | `#E9EEE9` | pale wash for active pills/badges |
| `--color-accent-weak-border` | `#C6D4C6` | active pill border |
| `--color-accent-contrast` | `#FAF9F6` | paper text on accent fill |

**Legacy aliases** (`--color-text-primary/secondary/tertiary/placeholder/label`, `--color-text-output`, `--color-border`, `--color-border-subtle`, `--color-border-strong`) are kept in `:root`, mapped onto the ink/rule tokens above, so pre-existing `var(--color-text-*)`/`var(--color-border*)` references resolve unchanged. New code should prefer the `--color-ink*` / `--color-rule*` names.

**Accent — forest green, used sparingly** (primary actions + active/selected + focus rings only; nothing else is accent-colored):
- Primary button: `bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)]`
- Active nav pill / selected card / badge: `border-[var(--color-accent)] bg-[var(--color-accent-weak)] text-[var(--color-accent)]` (weak-border variant for pills)
- Focus ring: `focus:ring-2 focus:ring-[var(--color-accent)]` (visible focus is required for a11y)
- Editorial links: `text-[var(--color-accent)] hover:underline`

**Status colors (muted editorial, tuned for paper — text meets WCAG AA):**
| Status | text / bg / border tokens |
|---|---|
| Success/pass/offer | `--color-success #35583F` / `--color-success-bg #E7EEE6` / `--color-success-border #C6D6C4` |
| Warning/review/interview | `--color-warning #7A5C1E` / `--color-warning-bg #F3EAD4` / `--color-warning-border #E0CFA3` |
| Error/reject/rejected | `--color-error #8F3A28` / `--color-error-bg #F3E2DC` / `--color-error-border #E2C1B4` |
| Neutral/withdrawn | `--color-text-tertiary` / `--color-elevated` / `--color-border` |

Use as `text-[var(--color-success)] bg-[var(--color-success-bg)] border border-[var(--color-success-border)]`. There is **no** `.dark:` variant — never add one. SVG score-ring `stroke`/`color` accept CSS vars directly: `stroke="var(--color-success)"` (score tiers map success ≥8 / accent 6–8 / warning 4–6 / error <4).

### Typography
Three families: **Fraunces** (display serif, via `next/font` → `var(--font-fraunces)`), **Geist Sans** (UI/body), **Geist Mono** (generated output only). Strong display↔body contrast is deliberate.

Display utility classes (defined in `globals.css`, all Fraunces with optical sizing):
- `.display-xl` — hero, `clamp(2.75rem,6vw,4.5rem)` / 1.05
- `.display-l` — key moments / section heroes, `clamp(2rem,4vw,3rem)` / 1.1
- `.display-m` — document & card titles, `1.75rem` / 1.2
- `.font-serif` — apply Fraunces at any size
- `.label-editorial` — uppercase tracked marginalia label, `0.75rem`, ink-tertiary

UI text (Geist Sans): section headings `text-base font-semibold text-[var(--color-text-primary)]`; subtext/hints `text-xs text-[var(--color-text-tertiary)]`; labels `text-sm font-medium text-[var(--color-text-label)]`. Generated output is Geist Mono: `font-mono text-[var(--color-text-output)]`.

### Components

**Card / panel (use sparingly — prefer hairline rules + whitespace):**
```
bg-[var(--color-surface)] rounded-md border border-[var(--color-rule)] p-6
```

**Form input / textarea:**
```
w-full border border-[var(--color-border)] rounded px-4 py-2.5 text-sm text-[var(--color-text-primary)]
placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]
focus:border-transparent bg-[var(--color-elevated)] transition
```
(textarea: `px-4 py-3 resize-none`)

**Primary button (active / disabled):**
```
bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)]
font-semibold rounded-md transition-colors
— disabled: bg-[var(--color-disabled)] text-[var(--color-text-placeholder)] cursor-not-allowed
```
The generate button is a plain accent button (the old `.btn-shimmer` is deleted — do not reintroduce animated gradients).

**Selected vs unselected card (user/doc/tone selectors):**
```
selected:   border-[var(--color-accent)] bg-[var(--color-accent-weak)] text-[var(--color-accent)]
unselected: border-[var(--color-border)] bg-[var(--color-elevated)] hover:border-[var(--color-border-strong)]
```

**Nav pill:** active `px-3 py-1.5 rounded text-sm font-medium text-[var(--color-accent)] bg-[var(--color-accent-weak)] border border-[var(--color-accent-weak-border)]`; inactive swaps to `text-[var(--color-text-secondary)]` with `hover:bg-[var(--color-elevated)]`.

**Pill / badge:** `inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border` + a status or accent-weak color set.

**Streaming caret:** apply `.caret` (globals.css — thin accent caret) to output text while streaming. The old `.cursor-blink` is deleted.

**Loading spinner:** `w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin` (inherits text color).

### Layout
- Max width `max-w-7xl mx-auto` for all pages **and** the shared Nav. Page padding `px-4 sm:px-6 py-8`.
- Nav: `bg-[var(--color-nav-bg)] backdrop-blur-xl border-b border-[var(--color-border-subtle)] sticky top-0 z-10`, inner `max-w-7xl mx-auto px-6 h-14`.
- Two-column generate: `lg:grid lg:grid-cols-[1fr_1fr] lg:gap-8 lg:items-start`; sticky right panel `lg:sticky lg:top-24`.

### Rounded corners (sharper = more editorial)
- `rounded` — inputs, small elements
- `rounded-md` — cards, panels, buttons, doc-type selectors
- `rounded-full` — pills, badges, dots **only**
- Do **not** use `rounded-2xl`/`rounded-xl` (the old default) for new work.

### globals.css utilities
`.display-xl/.display-l/.display-m`, `.font-serif`, `.label-editorial`, `.caret` (+ `caret-blink` keyframes), `.animate-fade-up` + `.animate-delay-1..4`. **Deleted (do not reintroduce):** aurora `body` gradient, `body::before` grain overlay, `.btn-shimmer`, `.text-gradient`, `.cursor-blink`, `@variant dark`, and the `html.light` block.

### Section numbering pattern
Generate-page form sections are numbered (1., 2., 3.) with a Geist-Sans heading `text-base font-semibold text-[var(--color-text-primary)]` and a one-line `text-xs text-[var(--color-text-tertiary)]` description. Numbers are dynamic (`sectionNum()` in `GenerateForm`) — keep that. Follow this pattern for new form sections.

---

## Environment variables

### Local (`.env.local`)
| Variable | Scope | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | server | Anthropic SDK auth |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Bypass RLS (webhook only) |
| `STRIPE_SECRET_KEY` | server | Stripe API |
| `STRIPE_WEBHOOK_SECRET` | server | Stripe signature verify |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | public | Stripe.js init |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | server | Pro monthly price ID |
| `STRIPE_PRICE_ID_PRO_ANNUAL` | server | Pro annual price ID |
| `UPSTASH_REDIS_REST_URL` | server | JD analysis cache (optional) |
| `UPSTASH_REDIS_REST_TOKEN` | server | JD analysis cache (optional) |

### Vercel-only (not in local `.env.local`)
| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | public | PostHog analytics key |
| `NEXT_PUBLIC_POSTHOG_HOST` | public | PostHog host |
| `SENTRY_AUTH_TOKEN` | server | Source map upload (every build — now always active) |
| `ADMIN_EMAILS` | server | Comma-separated admin emails for /admin/quality |
| `PROMPT_AB_VARIANT` | server | "A" or "B" — A/B test flag |

> `NEXT_PUBLIC_*` vars are baked in at build time — adding them in Vercel requires a redeploy. Runtime-only vars (`ADMIN_EMAILS`, `PROMPT_AB_VARIANT`) do not.

---

## Project directories

- `prompts/` — markdown source files for prompt engineering; **not imported at runtime**; used for iteration + version control of prompt logic before moving content into `lib/prompts.ts`
  - `prompts/generators/` — bullets.md, cover-letter.md, summary.md
  - `prompts/parsers/` — jd-parser.md
  - `prompts/user-types/` — career-switcher.md, executive.md, mid-career.md, student.md
  - `prompts/validators/` — quality-check.md
  - `prompts/tests/` — test cases + Python test runner
- `chrome-extension/` — Manifest V3 browser extension (see Key Files above)
- `supabase/` — schema + migrations + verify utility

---

## Coding conventions

### File structure
- Pages: `app/[route]/page.tsx` — one page per directory
- API routes: `app/api/[route]/route.ts`
- Shared components: `components/ComponentName.tsx` (PascalCase)
- Page-local sub-components: defined inline at the top of the page file, not extracted unless reused elsewhere
- Hooks: `hooks/useSomething.ts` (camelCase, `use` prefix)
- Shared types: `lib/types.ts` — only types used across multiple files
- Constants + config: `lib/constants.ts`
- Prompt builders: `lib/prompts.ts`
- Supabase clients: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server)

### Component patterns
- Client components: always `"use client"` as the first line
- Server components: no directive needed, make async when fetching data
- Props interfaces: defined inline above the component, not exported to `lib/types.ts` unless shared
- Simple prop callbacks: typed as `onChange: (v: string) => void` not `React.Dispatch<...>`

### TypeScript
- No `any`. Use `unknown` + type narrowing if the shape is truly unknown.
- Discriminated unions for SSE events (see `SseEvent` in `lib/types.ts`) — follow this pattern for any new event types
- `as const` on all config arrays and objects in `lib/constants.ts`

### State management
- React `useState` + `useCallback` in hooks — no external state library
- Keep SSE state in `useGenerate` hook, not in the page component
- Page components own form state; hooks own async/LLM state

### Async patterns
- `async/await` throughout — no `.then()` chains
- API routes: parse body first, validate, then do expensive work
- DB errors in the generate route are caught and logged but never thrown — generation must succeed even if DB save fails

### Code comments
- Section dividers: `// ── Section name ────────────────────────────` (em-dash style)
- Only comment non-obvious logic — don't comment self-explanatory code
- Don't add JSDoc or type annotations to code that wasn't changed

### Import order
1. Next.js (`next/...`)
2. React
3. Third-party libraries
4. Internal lib (`@/lib/...`)
5. Internal components/hooks (`@/components/...`, `@/hooks/...`)
6. Types (`import type { ... }`)

### What goes where
- Model names → `lib/constants.ts` (`MODELS`)
- Prompt version strings → `lib/constants.ts` (`PROMPT_VERSIONS`) — bump on every prompt edit
- Banned phrases list → `lib/constants.ts` (`BANNED_PHRASES`)
- Quality thresholds → `lib/constants.ts` (`PASS_THRESHOLD`, `MIN_DIMENSION_SCORE`)
- Prompt builder functions → `lib/prompts.ts` — pure functions, no side effects
- Shared TS types → `lib/types.ts`
- DB insert/select logic → inside the relevant API route, not abstracted into a separate lib until it's used in 3+ places

---

## What's off the table

These have been explicitly decided against. Don't suggest or implement them:

**Features:**
- Auto-apply / bulk apply — spam risk, race to the bottom, not the product positioning
- LinkedIn scraping or any third-party data ingestion beyond PDF upload
- Salary data, job board aggregation — out of scope for this product
- Multiplayer / sharing generated docs with others — not needed for MVP
- Mobile app — responsive web only

**Architecture:**
- Separate Express/FastAPI/NestJS backend — Next.js API routes handle everything until 10k+ users
- Job queue (BullMQ, Inngest, etc.) — not until async batch generation is needed (Week 4+)
- Redis for anything except JD analysis caching (Week 2) — don't introduce it earlier
- Prisma or any ORM — direct Supabase client only
- React Query, SWR, or any data-fetching library — server components + direct fetch
- Redux, Zustand, or any global state library — React state is sufficient
- Separate auth system — Supabase auth only, no NextAuth

**LLM design:**
- More than 2 LLM steps for MVP generation (outline → draft → critique → revise is too slow and costly; generate → validate → retry is the right tradeoff)
- Non-Anthropic models — Claude only; don't suggest OpenAI/Gemini alternatives
- Streaming with a queue/worker — the current SSE approach is correct for this use case
- Prompt logic in the API route — all prompt building belongs in `lib/prompts.ts`

**Code style:**
- Barrel files (`index.ts` re-exports) — import directly from the source file
- CSS-in-JS or styled-components — Tailwind only
- Class variance authority (CVA) or similar — too much abstraction for this codebase size
- Enums in TypeScript — use `as const` objects instead (already the pattern)
- Default exports for anything other than page/layout/route components

## Known gotchas
- Next.js 16 uses `proxy.ts` (exporting `async function proxy()`) as middleware — NOT `middleware.ts`. Do NOT create a `middleware.ts`; having both causes a conflict: "Both middleware file and proxy file are detected."
- OAuth callback route: for code exchange, use `NextRequest` and create the redirect response first, then wire Supabase `setAll` directly to `redirectResponse.cookies.set()`. Using `createClient()` from `lib/supabase/server` for code exchange is unreliable — its `cookieStore.set()` may not merge into `NextResponse.redirect()` response headers.
- Supabase `SECURITY DEFINER` triggers must include `SET search_path = public` and use fully qualified table names (`public.profiles`) or they fail with "Database error saving new user"
- Never log `candidate_input` or `jd_text` — PII
- Prompt versions must be bumped on every prompt change and stored on the generations row
- JD parse uses Haiku (`MODELS.parser`), not Sonnet — keep it that way
- DB save in generate route is fire-and-forget after SSE done event — errors are logged but never surfaced to user
- Stripe singleton (`lib/stripe.ts`) must be lazy (`getStripe()`) — `new Stripe()` at module level throws if `STRIPE_SECRET_KEY` is unset, breaking Next.js build-time page data collection
- Webhook route must use `req.text()` not `req.json()` — Stripe signature verification requires the raw body bytes
- When setting Vercel env vars via CLI, always use `printf '%s' 'value' | vercel env add ...` — `echo` adds a trailing newline which corrupts secrets (especially `STRIPE_WEBHOOK_SECRET`, causing every webhook delivery to fail with signature mismatch)
- Stripe checkout accepts `billingPeriod: "monthly" | "annual"` — price IDs are resolved server-side from env vars and never sent to the client
- Webhook service-role client: use `createClient` from `@supabase/supabase-js` directly (not `@supabase/ssr`) — the SSR client requires cookies which don't exist in a webhook context
- PDF text extraction uses `unpdf` (serverless-native pdfjs), NOT `pdf-parse`. `pdf-parse@2` pulls in `pdfjs-dist/legacy`, which throws `ReferenceError: DOMMatrix is not defined` on Vercel's serverless runtime (it wants a native canvas polyfill that isn't installed) — every PDF upload 500s there even though it works in local Node. `unpdf` needs no DOM/canvas. Usage: `const { extractText, getDocumentProxy } = await import("unpdf"); const { text } = await extractText(await getDocumentProxy(new Uint8Array(buffer)), { mergePages: true })` (text is a string with `mergePages: true`). Add `"unpdf"` to `serverExternalPackages` in `next.config.ts`.
- `DocumentType` now includes `"linkedin_about"` and `"linkedin_headline"` — any switch or Record keyed on `DocumentType` must handle all 5 values or TypeScript will error (affects `lib/export.ts` `DOC_TYPE_LABELS` and the generate route switch)
- `PROMPT_VERSIONS` must have an entry for every doc type used as a key — use `PROMPT_VERSIONS[doc_type as keyof typeof PROMPT_VERSIONS] ?? doc_type` fallback in the generate route to be safe
- Supabase CLI (v2.75+) installed via `brew install supabase/tap/supabase`; authenticate non-interactively with `SUPABASE_ACCESS_TOKEN=... supabase ...`; run ad-hoc SQL via the Management API: `POST https://api.supabase.com/v1/projects/{ref}/database/query` with `Authorization: Bearer {PAT}`
- JSZip: use `type: "arraybuffer"` not `"nodebuffer"` or `"uint8array"` — only `arraybuffer` is TypeScript-compatible with `Response` body; wrap result in `new Uint8Array()` and use `zipBytes.byteLength` for `Content-Length`
- Double-generation prevention: React state updates are async — a second click can fire before `isRunning` becomes `true`. Use a `useRef` lock set synchronously in the handler and reset in a `useEffect` when `isRunning` becomes false
- Cover letter must be explicitly instructed to use first person; the user type context block describes the candidate in third person which can bleed into the output if not overridden
- `NEXT_PUBLIC_*` env vars are baked in at build time — adding them in Vercel requires a redeploy to take effect; runtime-only vars (like `ADMIN_EMAILS`) do not require a redeploy
- LinkedIn About and Headline are JD-optional: `noJd: true` in `DOC_TYPES`, `JD_OPTIONAL_TYPES` set in generate route, JD section hidden in `GenerateForm` when these types are selected
- Supabase magic link redirects to localhost in production if the dashboard isn't configured: set **Site URL** to `https://shortlist-amber.vercel.app` and add `https://shortlist-amber.vercel.app/**` to **Redirect URLs** in Supabase Dashboard → Authentication → URL Configuration. The `emailRedirectTo` in `signInWithOtp` uses `window.location.origin` (correct), but Supabase ignores it unless the URL is in the allowlist.
- `Nav` is an async server component — cannot be imported directly into client components (`"use client"`). For client pages (e.g. `GenerateForm`), pass `userEmail` as a prop from the server wrapper and render `<UserMenu>` inline instead
- Social OAuth providers (Google, GitHub) must be enabled in Supabase Dashboard → Authentication → Providers with client ID + secret before the buttons do anything. LinkedIn OIDC is intentionally not part of the auth surface.
- Nav `maxWidth` prop was removed — all pages must use the shared `max-w-7xl` inner container. Do not add per-page width overrides to Nav or the buttons will shift between pages. Page content can use its own max-width independently.
- Nav `px-6` must be on the inner `<div>` not the `<nav>` element — if moved to `<nav>`, `mx-auto` centers within a narrowed viewport and content shifts relative to page body.
- **Theme is light-only ("paper & ink").** `next-themes`/`ThemeProvider` and the mode toggle were removed; `<html>` carries no theme class. Do **not** add `dark:` variants, `useTheme`, or a toggle — a single `:root` in `globals.css` is the whole theme. Style with `var(--color-*)` tokens only; never hardcode hex in components. Accent is forest green (`--color-accent`) for actions/active/focus only — no indigo anywhere.
- **`maxDuration` on every LLM route is mandatory** — Vercel defaults to 10s; Haiku generating 4096 tokens takes 15–25s. Every route that calls `anthropic.messages.create` must export `export const maxDuration = 60` (long outputs) or `30` (short outputs). Missing this causes silent timeout failures on the first attempt.
- **Supabase fire-and-forget increment**: use `void supabase.from(...).update(...).eq(...)` — do NOT chain `.then().catch()` on the Supabase query builder; its return type is `PromiseLike`, not a full `Promise`, so `.catch()` doesn't exist on it and TypeScript will error.
- **Supabase CLI ad-hoc SQL**: `supabase db execute` doesn't exist in v2.75. To run a migration against remote, use `supabase db push` (for tracked migrations) or connect via database URL. The Management API (`POST /v1/projects/{ref}/database/query`) requires a Personal Access Token (PAT), not the service role key.
- **Security hardening — Audit #1 (applied)**: open redirect in `auth/callback` prevented by validating `next` param starts with `/` and not `//`; Stripe checkout redirect URLs derived server-side from `x-forwarded-host` (never trust client); `follow-up` route requires auth + `MAX_FIELD_LEN=200` limits; `generate` route verifies `job_application_id` ownership before linking; `parse-resume` validates magic bytes (`%PDF` / `PK\x03\x04`) before passing to parsers; `applications` route uses `sanitizeUrl()` (rejects `javascript:` URIs), validates status enum, enforces field length limits, returns generic error messages; global security headers set in `next.config.ts` (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`)
- **Security hardening — Audit #2 (applied)**: `/api/export` requires auth (BUG-01); `/api/parse-resume` auth (BUG-02) was later relaxed to allow anonymous upload with an IP rate limit (10/hr) — parsing is cheap CPU and upload→first-generation is the try-before-signup moment; all `user_data` string fields sliced to 200 chars before prompt injection (BUG-03); `jd_analysis` fields recursively sanitized when pre-supplied by client (BUG-04); Stripe webhook DB writes now throw on Supabase error to trigger retry (BUG-05); ZIP batch export capped at 10 documents (BUG-06); body parse + validate moved before free usage slot consumption in score + fit routes (BUG-07/08); 30s per-user in-memory cooldown map on `/api/follow-up` (BUG-09); `res.ok` checked before `ApplicationsClient` optimistic UI update on status change (BUG-10); `question` (500) + `framework` (1000) truncated in `interview/evaluate` (BUG-11); generic message returned on Stripe webhook signature failure (BUG-12); invalid `tone` values rejected + defaulted to `"professional"` (BUG-13); `x-forwarded-host` restricted to `*.vercel.app` in `auth/callback` (BUG-14); generic error messages from `/api/profile/resume` (BUG-15); `navigator.clipboard.writeText` wrapped in try/catch in `OutputPanel` (BUG-16); `?jd=` URL param skipped if `> 20,000 chars` in `GenerateForm` (BUG-17)
