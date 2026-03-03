# Shortlist Chrome Extension

Adds a floating "Shortlist this job" button to supported job boards. One click extracts the job description and opens Shortlist with it pre-filled.

## Supported job boards

- Greenhouse (`boards.greenhouse.io`, `*.greenhouse.io/jobs/*`)
- Lever (`jobs.lever.co`, `*.lever.co`)
- Workday (`*.workday.com`, `myworkdayjobs.com`)
- Indeed (`www.indeed.com/viewjob`)
- LinkedIn (`www.linkedin.com/jobs/view/*`)

---

## Installing (development)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this `chrome-extension/` directory

---

## Publishing to Chrome Web Store

### Prerequisites

- [ ] A [Chrome Developer account](https://chrome.google.com/webstore/devconsole) ($5 one-time fee)
- [ ] At least 1 screenshot (1280×800 or 640×400 PNG) of the extension in action
- [ ] Privacy policy live at `https://shortlist-amber.vercel.app/privacy` ✅ (already deployed)

### Step 1 — Generate icons

```bash
node chrome-extension/generate-icons.js
```

This creates `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`.

### Step 2 — Package the extension

```bash
cd /path/to/project
zip -r shortlist-extension.zip chrome-extension/ \
  --exclude "chrome-extension/generate-icons.js" \
  --exclude "chrome-extension/README.md" \
  --exclude "chrome-extension/.DS_Store" \
  --exclude "chrome-extension/**/.DS_Store"
```

### Step 3 — Submit

1. Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click **New item** → upload `shortlist-extension.zip`
3. Fill in the store listing (copy below)
4. Upload at least 1 screenshot
5. Set **Category:** Productivity
6. Set **Privacy policy URL:** `https://shortlist-amber.vercel.app/privacy`
7. Under **Permissions justification**, explain each host permission (see below)
8. Submit for review (typically 1–3 business days)

---

## Store listing copy

### Title
```
Shortlist — AI Career Writing
```

### Summary (132 chars max)
```
One click to tailor your resume, cover letter, and LinkedIn profile to any job posting.
```

### Description (full)
```
Shortlist is an AI-powered career writing tool that tailors your resume bullets, cover letter, and LinkedIn profile to each job you apply for — in seconds.

HOW IT WORKS
───────────
1. Browse to any job posting on Greenhouse, Lever, Workday, Indeed, or LinkedIn
2. Click the "Shortlist this job" button that appears in the bottom-right corner
3. Shortlist opens in a new tab with the job description pre-filled
4. Generate tailored resume bullets, a cover letter, or a LinkedIn summary with one click

FEATURES
────────
• Auto-extracts job descriptions from 5 major job boards
• Works on Greenhouse, Lever, Workday, Indeed, and LinkedIn
• Zero setup — just install and browse to a job posting
• Your resume and career history are saved so every generation is personalised
• Export to DOCX or PDF

SUPPORTED SITES
───────────────
• Greenhouse (boards.greenhouse.io, *.greenhouse.io/jobs/*)
• Lever (jobs.lever.co)
• Workday (*.workday.com, myworkdayjobs.com)
• Indeed (www.indeed.com/viewjob)
• LinkedIn (www.linkedin.com/jobs/view/*)

PRIVACY
───────
The extension only reads job description text when you click the button. It stores nothing locally and sends no data to any server on its own. Full privacy policy: https://shortlist-amber.vercel.app/privacy
```

### Category
`Productivity`

### Language
`English`

---

## Permissions justification (for store review form)

| Permission | Justification |
|---|---|
| `activeTab` | Required to read the job description from the current tab when the user clicks the button. |
| `scripting` | Required to inject the floating "Shortlist this job" button into job board pages. |
| `storage` | Reserved for future use (e.g. persisting user preferences). Not actively used in v1.0. |
| `https://boards.greenhouse.io/*` | Inject button and extract JD on Greenhouse job boards. |
| `https://*.greenhouse.io/*` | Inject button and extract JD on company-hosted Greenhouse pages. |
| `https://jobs.lever.co/*` | Inject button and extract JD on Lever job postings. |
| `https://*.lever.co/*` | Inject button and extract JD on company-hosted Lever pages. |
| `https://myworkdayjobs.com/*` | Inject button and extract JD on Workday job postings. |
| `https://*.workday.com/*` | Inject button and extract JD on company-hosted Workday pages. |
| `https://www.indeed.com/*` | Inject button and extract JD on Indeed job postings. |
| `https://www.linkedin.com/*` | Inject button and extract JD on LinkedIn job postings. |

---

## How it works

`content.js` runs on job board pages and:
1. Injects a fixed-position floating button (bottom-right, indigo, z-index 999999)
2. When clicked, extracts the job description using board-specific DOM selectors with a heuristic fallback
3. Encodes up to 12,000 characters and opens `shortlist-amber.vercel.app/generate?jd=<encoded>` in a new tab
4. `app/generate/GenerateForm.tsx` reads `?jd=` on mount and pre-fills the JD textarea

`background.js` is a minimal service worker (MV3 requirement) with a fallback handler for direct toolbar icon clicks.
