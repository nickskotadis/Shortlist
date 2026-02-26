# Shortlist — Project Context for Claude

## What this is
AI resume + cover letter generator with job description tailoring. Next.js 16, React 19, Supabase, Anthropic SDK, Stripe (not yet wired), Tailwind v4. Deployed to Vercel (not yet deployed).

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

### Week 4 — TODO
- Stripe billing (Free / Pro)
- `/api/stripe/hook` webhook
- Generation rate limits by plan
- Usage meter in UI

### Week 5 — TODO
- PostHog event instrumentation (metadata only, never content)
- Internal quality dashboard (scores by prompt version)
- Sentry with PII scrubbing
- A/B test flag for prompt variant

## Key files
- `lib/constants.ts` — model names, prompt versions, banned phrases, thresholds
- `lib/prompts.ts` — all prompt builders; bump `PROMPT_VERSIONS` on every change
- `lib/types.ts` — shared types including SSE event shapes
- `app/api/generate/route.ts` — main LLM pipeline (SSE streaming)
- `hooks/useGenerate.ts` — client-side SSE consumer
- `supabase/schema.sql` — base schema
- `supabase/migration_001.sql` — plan/billing + generation metadata columns
- `supabase/migration_002.sql` — feedback_positive column + UPDATE RLS policy
- `supabase/migration_003.sql` — drop feedback_rating; generation_count trigger
- `lib/export.ts` — server-only DOCX + PDF generators (never import from client components)
- `hooks/useGenerate.ts` — `GenerateResult` includes `generationId: string | null` (null for unauthenticated)
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
