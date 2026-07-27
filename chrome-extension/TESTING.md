# Shortlist Extension — Cross-Board Testing Checklist

Manual test plan for `content.js`. The extension has no automated tests, so this
checklist is how we confirm the button injects reliably and extraction degrades
gracefully across every supported board.

## Setup

1. `node --check chrome-extension/content.js` — confirms it parses.
2. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked**
   → select the `chrome-extension/` directory. After any edit, click the reload
   ↻ icon on the extension card, then reload the job page.
3. Open **DevTools → Console** and **keep it open** while testing. All diagnostics
   are prefixed `[Shortlist]`. Filter the console by `Shortlist` to isolate them.

## How to read the log line

Every click (and every board re-render / SPA navigation) emits a line:

```
[Shortlist] board=lever url=/metabase/7f3c… selectorTried=".posting-page" selectorHit=false chars=1843 path=generic:main
```

| Field | Meaning |
|---|---|
| `board` | Detected board (`greenhouse`/`lever`/`workday`/`indeed`/`linkedin`/`unknown`). |
| `url` | `location.pathname` (no query string; no JD text). |
| `selectorTried` | The last board-specific selector attempted. |
| `selectorHit` | `true` = a board selector cleared the 200-char threshold; `false` = fell back. |
| `chars` | Extracted character count. A real JD is normally ≥ ~200. |
| `path` | Where the text came from: `board:<board>`, `generic:main`, `generic:article`, `generic:largest`, `generic:body`, or `none`. |

You will also see, separately:
- `[Shortlist] button injected (board=…)` — on first injection.
- `[Shortlist] re-injecting (button was removed)` — self-heal fired after a re-render (this is the fix for the button disappearing).
- `[Shortlist] navigation → /… (board=…)` — SPA navigation detected; state reset for the new posting.

## Success / fallback / failure signals

- **✅ Success (board):** button visible bottom-right; `selectorHit=true`, `path=board:*`, `chars` ≥ ~200.
- **✅ Success (fallback):** `selectorHit=false` but `path=generic:*` with a healthy `chars`. Acceptable — note which generic path carried it (this is expected on boards whose selectors we can't pin exactly, e.g. some Lever tenants).
- **❌ Failure:** `path=none` or very low `chars`. The button switches to the error state **"Couldn't read this posting — paste manually"** and still opens `/generate` empty. Investigate the selector for that board and add/adjust it in `BOARD_SELECTORS`.

For every case, also do the **/generate check**: the new tab should open with the
JD textarea pre-filled and matching the posting — or empty (with the manual-paste
button message) when `path=none`.

---

## Per-board checklist

### Greenhouse — test BOTH hosts

- [ ] `https://boards.greenhouse.io/<company>/jobs/<id>` (classic host)
- [ ] `https://job-boards.greenhouse.io/<company>/jobs/<id>` (modern host)

Expect `board=greenhouse`, ideally `path=board:greenhouse`. If a host renders the
description outside the known selectors, a `generic:*` path with healthy `chars`
is still a pass — just record which one.

### Lever — test BOTH the tenants that diverged in live testing

- [ ] `https://jobs.lever.co/wealthfront/<id>` (previously injected correctly)
- [ ] `https://jobs.lever.co/metabase/<id>` (previously did **not** inject)

The button **must appear on both**. Confirm you see `[Shortlist] button injected
(board=lever)` on each. If either tenant re-renders and wipes the button, you
should see `re-injecting (button was removed)` and the button return — never a
silent disappearance. Extraction may land on `path=board:lever` or fall back to
`generic:main`/`generic:largest`; both are acceptable as long as `chars` is healthy.

### Workday — tenant subdomain

- [ ] `https://<tenant>.myworkdayjobs.com/<lang>/<site>/job/<…>` (e.g. a `wd1`/`wd5` tenant)
- [ ] If available: a company-hosted `https://<co>.workday.com/<…>/job/<…>` page

Workday lazy-renders the posting body; if the button is clicked before the
description panel loads, expect a low-`chars` line — wait for the panel, then
click again. Expect `board=workday`, `path=board:workday` when the
`jobPostingDescription` node is present.

### Indeed — search pane vs direct view

- [ ] Direct: `https://www.indeed.com/viewjob?jk=<id>`
- [ ] Search pane: `https://www.indeed.com/jobs?q=…&vjk=<id>` — then **click a
      different result** in the left list and confirm a **fresh** `[Shortlist]
      navigation → …` line appears (the `?vjk=` change is an SPA update, not a
      full load). Click Shortlist and verify the JD matches the *currently
      selected* posting, not the first one.

Expect `board=indeed`, `path=board:indeed` (`#jobDescriptionText`).

### LinkedIn — job view vs search pane

- [ ] Direct: `https://www.linkedin.com/jobs/view/<id>`
- [ ] Search pane: `https://www.linkedin.com/jobs/search/?currentJobId=<id>` —
      **click between several jobs** in the list. Each selection changes
      `currentJobId` without a full load; confirm a fresh `navigation →` line per
      posting and that extraction reads the currently open job.

LinkedIn is the heaviest SPA and the strongest test of the self-heal + SPA logic.
Expect `board=linkedin`; a `generic:*` fallback is common here and is a pass with
healthy `chars`.

---

## Regression checks (any board)

- [ ] **Self-heal:** on a board that re-renders after load (Lever, LinkedIn),
      confirm the button persists — if it briefly vanishes you should see a
      `re-injecting` line and it should come back within a frame.
- [ ] **No duplicates:** only ever one button (`document.querySelectorAll('#shortlist-ext-btn').length === 1`).
- [ ] **Failure state:** on a page with no readable JD (e.g. a board index page),
      clicking shows "Couldn't read this posting — paste manually", opens
      `/generate` empty, and logs `path=none`. It then resets after a few seconds.
- [ ] **No PII in logs:** the console never prints job-description text — only
      `chars=<count>`, the selector string, and the URL path.
- [ ] **Theme:** the button is forest `#2F4A3C` on paper text `#FAF9F6` (error
      state uses the muted brick `#8F3A28`) — no navy/indigo anywhere.
