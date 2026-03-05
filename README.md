# Shortlist

An AI-powered career writing platform that generates tailored resumes, cover letters, LinkedIn content, and interview prep materials — adapting to your industry, role, seniority, and goals.

**Live:** [shortlist-amber.vercel.app](https://shortlist-amber.vercel.app)

---

## What it does

Shortlist takes your raw resume and a job description, then runs it through a multi-step LLM pipeline to produce polished, ATS-optimised career documents. It scores its own output for quality, flags hallucinations, and retries if the bar isn't met. Every generated document is stored against your account for review, export, and feedback.

---

## Features

### Document generation
- **Resume bullets** — 5 impact-focused bullets with STAR structure, quantified claims, structural variety, and JD keyword mirroring
- **Professional summary** — 3–4 sentence summary tailored to the exact role and hiring manager concern
- **Cover letter** — 4-paragraph first-person letter with a hook, evidence, company-specific paragraph, and confident close
- **LinkedIn About** — 200–300 word first-person narrative with keyword density for recruiter search
- **LinkedIn Headline** — 220-character keyword-dense headline with differentiation

### User type personalisation
Every document is framed differently based on the candidate's situation:
- **Career switcher** — reframes transferable skills as strengths; never defensive about the transition
- **Mid-career professional** — emphasises ownership, scope, and upward trajectory
- **Student / new graduate** — extracts maximum signal from projects, internships, and coursework
- **Executive** — leads with P&L, org size, and strategic narrative

### Tone selector
Three writing tones apply across all document types:
- **Professional** — polished and formal; default for most industries
- **Conversational** — warm and approachable; suits startups and creative roles
- **Bold / Direct** — high-confidence and punchy; ideal for sales, leadership, and exec

### Quality assurance pipeline
Every generation goes through a 4-stage pipeline:
1. **JD parser (Haiku)** — extracts explicit requirements, implicit signals, must-haves, key terminology, and the hiring manager's core concern
2. **Generator (Sonnet)** — produces the document using the parsed JD and candidate background
3. **Validator (Haiku)** — scores 5 dimensions (specificity, relevance, authenticity, impact, cleanliness), detects hallucinations and skill inflation; verdicts: PASS / REVISE / REJECT
4. **Auto-retry (Sonnet)** — if the validator returns REJECT, a second generation is triggered with the specific issues injected into the prompt

### Quality score ring
Every output shows a 1–10 quality ring (emerald ≥8, indigo ≥6, amber <6) derived from the validator's scores.

### Keyword gap analysis
After generation, matched and missing JD keywords are shown inline — green checkmarks for keywords found in the output, grey crosses for gaps.

### Tailoring recommendations
A 5th background call (Haiku) fires after every successful generation and returns 3–5 specific, actionable changes the candidate should make to their base resume to better match the role.

### Full application package — Pro
Batch mode generates resume bullets, a cover letter, and a LinkedIn About section sequentially in a single flow, caching the JD parse across all three documents. Output is shown in a tabbed panel and can be exported as a ZIP file containing all three documents.

### Resume health score
Free page at `/score` — paste or upload a resume, get scores across 5 dimensions (clarity, impact, ATS-friendliness, action verbs, quantification), an overall score, and 3–5 specific recommendations. No generation count used.

### Interview prep
Free page at `/interview` — generates 6–8 tailored interview questions covering all 4 categories (behavioral, technical, situational, culture). Each question includes what the interviewer is actually assessing and a STAR-format answer framework tailored to the candidate's resume.

### AI Answer Coach — Pro
On every interview question card, Pro users can expand a practice panel, type their answer, and receive:
- A 1–10 score
- 2–3 sentences of direct, specific feedback
- "What worked" list (emerald bullets)
- "What to improve" list (amber bullets)

All feedback is grounded in the candidate's resume and the JD context.

### Job application tracker
Full CRUD tracker at `/applications` with statuses: `applied`, `interview`, `offer`, `rejected`, `withdrawn`. Each application links to any generated documents via a foreign key. Status updates are immediate with optimistic UI.

### Follow-up email generator
From any application in "applied" status, generate a 3–4 sentence follow-up email with subject line via Haiku.

### Export
- **DOCX** — server-side generation via the `docx` package with correct section formatting per document type
- **PDF** — server-side via `@react-pdf/renderer`
- **ZIP** — batch export via `jszip`; all three batch documents in one download

### Resume upload and parsing
PDF and DOCX files are parsed server-side (`pdf-parse` for PDFs, `mammoth` for DOCX). Parsed text pre-fills the resume textarea across generate, score, and interview pages. File size capped at 5 MB; magic byte validation prevents spoofed file types.

### Named generations
Every generated document can be given a label — shown as the card title in the dashboard and editable inline.

### Dashboard
Authenticated users see their last 50 generations with expandable cards showing the full output, quality scores, thumbs up/down feedback, copy to clipboard, export, and inline label editing.

### Billing
| Plan | Generations |
|------|-------------|
| Free | 2/month |
| Pro | Unlimited + batch mode + answer coach |

Stripe Checkout for upgrades, Stripe Customer Portal for billing management. Webhook handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

### Chrome extension
Manifest V3 extension that extracts job descriptions from Greenhouse, Lever, Workday, Indeed, and LinkedIn. A floating button opens `shortlist-amber.vercel.app/generate?jd=<encoded>` with the JD pre-filled.

### Analytics and observability
- **PostHog** — event tracking for `generation_started`, `generation_completed`, `document_type_selected`, `tone_selected`, `export_clicked`, `upgrade_clicked`, `score_page_viewed`, `interview_prep_generated`, `interview_answer_evaluated` — metadata only, never content fields
- **Sentry** — error monitoring with Session Replay on client; source maps uploaded on every build; PII stripped
- **Admin quality dashboard** — internal prompt quality monitoring; aggregates generations by prompt version with count, avg score, pass rate, and thumbs-up rate

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI | React 19 |
| Database | Supabase (Postgres + Row Level Security) |
| Auth | Supabase Auth (magic link, Google, LinkedIn OIDC, GitHub OAuth) |
| LLM | Anthropic SDK — Claude Sonnet 4.6 (generation), Claude Haiku (parsing, validation, scoring) |
| Payments | Stripe (Checkout, Customer Portal, Webhooks) |
| Caching | Upstash Redis (JD analysis cache, 1h TTL, optional) |
| Export | `docx`, `@react-pdf/renderer`, `jszip` |
| File parsing | `pdf-parse`, `mammoth` |
| Analytics | PostHog |
| Error monitoring | Sentry (`@sentry/nextjs` v10) |
| Deployment | Vercel |

---

## Architecture

### LLM pipeline

```
User input
    │
    ▼
[Stage 1] JD Parser — Haiku
    Extracts: role, seniority, must-haves, implicit signals, key terminology,
              hiring manager worry, tone target
    Cached in Upstash Redis (SHA-256 hash key, 1h TTL)
    │
    ▼
[Stage 2] Generator — Sonnet (streaming SSE)
    Receives: user type block, JD analysis, candidate input, tone override
    Streams text chunks to the client via Server-Sent Events
    │
    ▼
[Stage 3] Validator — Haiku
    Scores: specificity, relevance, authenticity, impact, cleanliness (1–10 each)
    Detects: hallucinations, skill inflation, banned phrases
    Verdict: PASS / REVISE / REJECT
    │
    ├─ PASS ──► [Stage 5] Tailoring recommendations (background, fire-and-forget)
    │
    └─ REJECT ► [Stage 4] Retry — Sonnet
                    Issues injected into prompt
                    Maximum 1 retry
                    │
                    ▼
                    Back to Stage 3
```

### Streaming
The generate endpoint uses Server-Sent Events. SSE event types:
- `jd_analysis` — parsed JD object sent first so the client can show JD insights immediately
- `text` — streamed token chunks
- `retry` — notifies client a retry is in progress
- `done` — final output, scores, verdict, generation ID, keywords, prompt version
- `tailoring_suggestions` — fires asynchronously after `done`
- `error` — non-retryable failure

### Prompt quality controls
- Banned phrase list enforced at prompt level and checked by the validator
- Em dash rule across all generators — the strongest AI writing signal; all prompts explicitly ban `—` as a clause connector
- Quality bar test: "Could this appear on 50 other people's resumes?" — if yes, the prompt instructs the model to rewrite it
- Structural variety required in resume bullets — no all-`[Verb + what + result]` rhythm
- Hallucination issues are surfaced to the user via the issues list but do not drive retries — retrying can't fix fabricated metrics when input is vague

---

## Pages

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Landing page |
| `/generate` | Public (limited) | Main document generation form |
| `/dashboard` | Auth required | Generation history with scores and export |
| `/score` | Public | Resume health score (free, no generation count) |
| `/interview` | Public | Interview prep questions + AI Answer Coach (coach is Pro) |
| `/applications` | Auth required | Job application tracker |
| `/pricing` | Public | Plan comparison with Stripe checkout |
| `/privacy` | Public | Privacy policy (required for Chrome Web Store) |
| `/admin/quality` | Admin only | Prompt quality dashboard |
| `/auth/login` | Public | Magic link + OAuth sign-in |

---

## API routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/generate` | Optional | Main generation pipeline (SSE stream) |
| POST | `/api/parse-resume` | None | PDF/DOCX → plain text |
| POST | `/api/score` | None | Resume health score |
| POST | `/api/interview` | None | Interview question generation |
| POST | `/api/interview/evaluate` | Pro required | AI Answer Coach evaluation |
| POST | `/api/follow-up` | Auth required | Follow-up email generation |
| GET/PUT | `/api/profile/resume` | Auth required | Saved master resume |
| GET/POST/PATCH | `/api/applications` | Auth required | Job application CRUD |
| PATCH | `/api/generations/[id]/label` | Auth required | Name a generation |
| PATCH | `/api/generations/[id]/feedback` | Auth required | Thumbs up/down |
| POST | `/api/export` | None | DOCX / PDF / ZIP export |
| POST | `/api/stripe/checkout` | Auth required | Create Stripe Checkout session |
| POST | `/api/stripe/portal` | Auth required | Create Stripe Customer Portal session |
| POST | `/api/stripe/webhook` | Stripe signature | Handle subscription lifecycle events |

---

## Database schema

Managed by Supabase. All user tables have Row Level Security enabled.

### Tables

**`profiles`**
- `id` (FK → `auth.users`)
- `plan` — `"free" | "pro"`
- `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`
- `generation_count` — total lifetime count, incremented by trigger
- `resume_text` — saved master resume (optional)

**`generations`**
- `id`, `user_id` (FK)
- `document_type`, `output`, `jd_text`, `candidate_input`
- `user_type`, `tone`
- `score_overall`, `score_specificity`, `score_relevance`, `score_authenticity`, `score_impact`, `score_clean`
- `validator_verdict`, `retry_count`
- `prompt_version`, `ab_variant`
- `label` — user-defined name
- `feedback_positive` — thumbs up/down
- `input_tokens`, `output_tokens`

**`job_applications`**
- `id`, `user_id` (FK)
- `company`, `role`, `status` — `applied | interview | offer | rejected | withdrawn`
- `url`, `notes`
- `generation_id` (FK, optional) — links to a generated document

### Migrations

| File | Changes |
|------|---------|
| `migration_001.sql` | Plan/billing columns, generation metadata |
| `migration_002.sql` | `feedback_positive` column, UPDATE RLS policy |
| `migration_003.sql` | Drop unused `feedback_rating`; `on_generation_created` trigger for `generation_count` |
| `migration_004.sql` | `profiles.resume_text`, `generations.label`, `generations.tone` |
| `migration_005.sql` | `generations.ab_variant` |
| `migration_006.sql` | `job_applications.status`, `url`, `notes` |

---

## Chrome extension

Located in `chrome-extension/`. Manifest V3.

**Supported job boards:** Greenhouse, Lever, Workday, Indeed, LinkedIn

`content.js` extracts the job description text from the page and injects a floating indigo button. Clicking it opens `shortlist-amber.vercel.app/generate?jd=<encoded>`. The generate page reads the `?jd=` param on mount and pre-fills the JD textarea.

Build icons: `node chrome-extension/generate-icons.js` (zero-dependency PNG generator).

---

## Local development

```bash
# Install dependencies
npm install

# Set up environment variables (see table below)
cp .env.local.example .env.local

# Run development server
npm run dev
```

### Required environment variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (webhook only, bypasses RLS) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | Stripe price ID for Pro monthly |
| `STRIPE_PRICE_ID_PRO_ANNUAL` | Stripe price ID for Pro annual |

### Optional environment variables

| Variable | Description |
|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | JD analysis cache (app works without it) |
| `UPSTASH_REDIS_REST_TOKEN` | JD analysis cache |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN |
| `SENTRY_AUTH_TOKEN` | Source map upload on build |

---

## Project structure

```
app/
  (pages)/
    page.tsx                   Landing
    dashboard/                 Generation history
    generate/                  Main generation form + output panel
    score/                     Resume health score
    interview/                 Interview prep + AI Answer Coach
    applications/              Job application tracker
    pricing/                   Pricing page
    admin/quality/             Internal quality dashboard
    auth/                      Login, callback, logout
  api/
    generate/                  SSE generation pipeline
    parse-resume/              File → text parser
    score/                     Health score
    interview/                 Question generation
    interview/evaluate/        Answer Coach (Pro)
    follow-up/                 Follow-up email
    profile/resume/            Saved resume CRUD
    applications/              Application tracker CRUD
    generations/[id]/          Label + feedback endpoints
    export/                    DOCX / PDF / ZIP
    stripe/                    Checkout, portal, webhook

components/
  Nav.tsx                      Async server nav (auth + plan fetch)
  UserMenu.tsx                 Client avatar + dropdown
  OutputPanel.tsx              Quality ring, tailoring panel, keyword gap
  NavMobileMenu.tsx            Mobile nav drawer
  PostHogProvider.tsx          Analytics init wrapper

hooks/
  useGenerate.ts               SSE consumer for single document generation
  useBatchGenerate.ts          Sequential batch generation

lib/
  constants.ts                 Model names, prompt versions, thresholds, tones
  prompts.ts                   All prompt builder functions
  types.ts                     Shared TypeScript types
  stripe.ts                    Lazy Stripe singleton
  supabase/
    client.ts                  Browser Supabase client
    server.ts                  Server Supabase client (cookie-based)

supabase/
  schema.sql                   Base schema
  migration_001-006.sql        Incremental schema migrations

chrome-extension/              Manifest V3 browser extension
prompts/                       Markdown source files for prompt iteration (not imported at runtime)
```

---

## Key engineering decisions

- **No middleware.ts** — Next.js 16 uses `proxy.ts` exporting `async function proxy()` as the session refresh middleware. Having both files causes a conflict error.
- **SSE not WebSockets** — streaming generation fits a request/response model; SSE is simpler and sufficient
- **Haiku for parsing/validation** — 6x cheaper than Sonnet with equivalent accuracy for structured JSON extraction tasks
- **Fire-and-forget tailoring** — the tailoring recommendations call runs after the `done` SSE event so it never delays the main result
- **No ORM** — direct Supabase client throughout; no Prisma
- **No global state library** — React `useState` + custom hooks handle all async state
- **Lazy Stripe singleton** — `new Stripe()` at module level throws if `STRIPE_SECRET_KEY` is unset, breaking Next.js build-time page collection
- **Webhook uses service-role client** — the SSR Supabase client requires cookies; webhooks have no cookie context, so the raw `@supabase/supabase-js` client with the service role key is used directly
- **JSZip type** — `type: "arraybuffer"` (not `nodebuffer` or `uint8array`) is the only TypeScript-compatible option for passing to `Response`
- **Double-generation prevention** — React state updates are async; a `useRef` lock is set synchronously in the submit handler and cleared in a `useEffect` to close the window between clicks
