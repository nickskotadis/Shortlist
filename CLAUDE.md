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
- Stripe billing: Free (2 generations/month) and Pro (unlimited, $4.99/mo or $49.99/yr)
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

### Week 5 — TODO
- PostHog event instrumentation (metadata only, never content)
- Internal quality dashboard (scores by prompt version)
- Sentry with PII scrubbing
- A/B test flag for prompt variant

### Post-Week 4 features — DONE
- **Save master resume** — `profiles.resume_text text` column; GET/PUT `/api/profile/resume`; generate page fetches it server-side and pre-fills the resume textarea; "Save as default resume" button persists on blur; "Saved ✓" badge when populated
- **PDF/DOCX upload** — `/api/parse-resume` POST accepts multipart `file` field; `pdf-parse` (CommonJS — dynamic import with ESM compat fallback) for PDFs, `mammoth` for DOCX; both in `serverExternalPackages`; shared by `/generate` and `/score`
- **Named generations** — `generations.label text` column; PATCH `/api/generations/[id]/label`; inline label input in `OutputPanel` (saves on blur/Enter); label shown as card title in dashboard, editable inline in expanded card view
- **Keyword gap analysis** — `done` SSE event now includes `keywords: string[]` (from `jdAnalysis.key_terminology`); `OutputPanel` shows matched keywords (green ✓) vs missing (grey ✗) using case-insensitive substring match on the output text
- **LinkedIn doc types** — `DocumentType` extended to include `"linkedin_about" | "linkedin_headline"`; both are JD-optional (`noJd: true` in DOC_TYPES); new prompt builders `buildLinkedInAboutPrompt()` and `buildLinkedInHeadlinePrompt()` in `lib/prompts.ts`; generate route handles both in the switch
- **Tone selector** — `ToneType = "professional" | "conversational" | "bold"` in `lib/types.ts`; `TONES` config array in `lib/constants.ts`; `buildToneInstruction(tone)` injects tone override block into all generator prompts; `tone` stored on `generations` row; UI in generate form section (3 toggle buttons)
- **Resume health score** — free page at `/score`; `/api/score` POST uses Haiku (`MODELS.parser`) + `buildHealthScorePrompt()`; scores 5 dimensions (clarity, impact, ats_friendliness, action_verbs, quantification); SVG score ring + dimension cards + 3–5 recommendations; CTA links to `/generate`; PDF/DOCX upload supported
- **Session expiry UX** — `useGenerate` now sets `sessionExpired: boolean` on 401 response; `GenerateForm` shows "Session expired — log in again" amber card instead of silent failure
- **Chrome extension JD import** — `GenerateForm` reads `?jd=` URL param on mount via `useEffect` and pre-fills `jdText`; no backend changes needed
- **Dashboard empty state** — improved with icon, descriptive copy, and "Score my resume" secondary CTA
- **`migration_004.sql`** — `profiles.resume_text`, `generations.label`, `generations.tone`; applied to production

## Key files
- `lib/constants.ts` — model names, prompt versions, banned phrases, thresholds, `FREE_MONTHLY_LIMIT`, `TONES`
- `lib/prompts.ts` — all prompt builders; bump `PROMPT_VERSIONS` on every change; includes `buildToneInstruction()`, `buildLinkedInAboutPrompt()`, `buildLinkedInHeadlinePrompt()`, `buildHealthScorePrompt()`
- `lib/types.ts` — shared types including SSE event shapes; `ToneType`, `HealthScoreResult`, updated `DocumentType`
- `lib/stripe.ts` — lazy `getStripe()` singleton (server only — never import from client)
- `app/api/generate/route.ts` — main LLM pipeline (SSE streaming) with rate limit check; handles all 5 doc types; sends `keywords` in `done` event; stores `tone` on DB insert
- `app/api/profile/resume/route.ts` — GET/PUT saved resume text for authenticated user
- `app/api/generations/[id]/label/route.ts` — PATCH label on a generation (RLS-enforced)
- `app/api/parse-resume/route.ts` — multipart POST; pdf-parse (PDF) + mammoth (DOCX); max 5 MB
- `app/api/score/route.ts` — POST resume text, returns `HealthScoreResult` via Haiku
- `app/api/stripe/checkout/route.ts` — creates Stripe Checkout Session
- `app/api/stripe/portal/route.ts` — creates Stripe Customer Portal session
- `app/api/stripe/webhook/route.ts` — handles Stripe webhook events, service-role Supabase writes
- `app/generate/page.tsx` — async server wrapper; fetches plan + monthly usage + `profiles.resume_text`; passes `savedResume: string | null` to GenerateForm
- `app/generate/GenerateForm.tsx` — `"use client"` form component; accepts `initialUsage: PlanUsage | null` + `savedResume: string | null`; handles PDF upload, save resume, tone selector, LinkedIn types, ?jd= param
- `app/score/page.tsx` — `"use client"` resume health score page; free, no generation count
- `app/pricing/page.tsx` — pricing page (Free vs Pro, monthly/annual toggle)
- `hooks/useGenerate.ts` — SSE consumer; exposes `limitReached: boolean`, `sessionExpired: boolean`; `GenerateResult` includes `keywords: string[]`
- `components/OutputPanel.tsx` — keyword gap panel (`KeywordGap`), label input (`LabelInput`), hiring manager worry box
- `supabase/schema.sql` — base schema
- `supabase/migration_001.sql` — plan/billing + generation metadata columns
- `supabase/migration_002.sql` — feedback_positive column + UPDATE RLS policy
- `supabase/migration_003.sql` — drop feedback_rating; generation_count trigger
- `supabase/migration_004.sql` — resume_text, label, tone columns (applied)
- `lib/export.ts` — server-only DOCX + PDF generators; handles all 5 doc types
- `proxy.ts` — Next.js 16 session middleware (note: not `middleware.ts`)

## Design system

### Colors
- **Primary:** `indigo-600` (hover: `indigo-700`), light tint `indigo-50`, text `indigo-700`
- **Page background:** `slate-50` (not white — use `bg-slate-50` on page wrappers)
- **Card background:** `bg-white`
- **Text hierarchy:** `slate-900` headings, `slate-700` labels/body, `slate-500` secondary, `slate-400` hints/placeholders/meta
- **Borders:** `border-slate-200` default, `border-slate-100` subtle (nav dividers)
- **Status colors:** `emerald` = pass/success, `amber` = warning/review, `red` = error/reject

### Typography
- Font: Geist Sans (body), Geist Mono (generated output only — `font-mono`)
- Section headings: `text-sm font-semibold text-slate-900`
- Section subtext: `text-xs text-slate-400`
- Labels: `text-sm font-medium text-slate-700 mb-1.5`
- Hint text below inputs: `text-xs text-slate-400 mt-1.5`
- Nav brand: `text-lg font-semibold text-slate-900 tracking-tight`

### Components

**Cards (content sections):**
```
bg-white rounded-2xl border border-slate-200 p-6 shadow-sm
```

**Form inputs:**
```
w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900
placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500
focus:border-transparent bg-white transition
```

**Textareas:** same as input but `px-4 py-3` and `resize-none`

**Primary button (active):**
```
bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm transition-all
```

**Primary button (disabled):**
```
bg-slate-100 text-slate-400 cursor-not-allowed
```

**Selected/active card state** (user type selector, doc type selector):
```
border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500
```
Text inside selected card: `text-indigo-700`

**Unselected card state:**
```
border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50
```

**Pills/badges:**
```
inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full
```
- Success: `text-emerald-700 bg-emerald-50` with `w-1.5 h-1.5 bg-emerald-500 rounded-full` dot
- Warning: `text-amber-700 bg-amber-50` with amber dot
- Error: `text-red-700 bg-red-50` with red dot
- Neutral (JD tags): `text-indigo-700 bg-indigo-50` or `text-slate-500 bg-slate-100`

**Loading spinner:**
```
w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin
```
(Use `border-indigo-500` when on a light background)

**Streaming cursor:** apply `.cursor-blink` class (defined in globals.css) to output text while streaming

### Layout
- Max width: `max-w-7xl mx-auto` for app pages, `max-w-6xl` for landing nav, `max-w-4xl` for landing hero
- Page padding: `px-4 sm:px-6 py-8`
- Nav: `bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-10`
- Two-column generate layout: `lg:grid lg:grid-cols-[1fr_1fr] lg:gap-8 lg:items-start`
- Sticky right panel: `lg:sticky lg:top-24`
- Section spacing inside a card: `space-y-6`
- Grid for form fields: `grid grid-cols-1 sm:grid-cols-2 gap-4`

### Rounded corners
- `rounded-lg` — inputs, small elements
- `rounded-xl` — buttons, doc type selectors
- `rounded-2xl` — cards, output panels, user type selectors

### Section numbering pattern
Form sections on the generate page are numbered (1., 2., 3. etc.) with the heading `text-sm font-semibold text-slate-900 mb-1` and a one-line description `text-xs text-slate-400 mb-4` below it. Follow this pattern for any new form sections.

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
- AI interview prep, salary data, job board aggregation — out of scope for this product
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
- Next.js 16: middleware file is `proxy.ts` exporting `async function proxy()`, not `middleware.ts`
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
- `pdf-parse` is CommonJS and its ESM shim has no `.default` export — use `(await import("pdf-parse") as any).default ?? module` pattern; add `"pdf-parse"` to `serverExternalPackages` in `next.config.ts`
- `DocumentType` now includes `"linkedin_about"` and `"linkedin_headline"` — any switch or Record keyed on `DocumentType` must handle all 5 values or TypeScript will error (affects `lib/export.ts` `DOC_TYPE_LABELS` and the generate route switch)
- `PROMPT_VERSIONS` must have an entry for every doc type used as a key — use `PROMPT_VERSIONS[doc_type as keyof typeof PROMPT_VERSIONS] ?? doc_type` fallback in the generate route to be safe
- Supabase CLI (v2.75+) installed via `brew install supabase/tap/supabase`; authenticate non-interactively with `SUPABASE_ACCESS_TOKEN=... supabase ...`; run ad-hoc SQL via the Management API: `POST https://api.supabase.com/v1/projects/{ref}/database/query` with `Authorization: Bearer {PAT}`
